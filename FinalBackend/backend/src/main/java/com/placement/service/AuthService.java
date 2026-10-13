package com.placement.service;

import com.placement.dto.AuthDtos.*;
import com.placement.email.EmailService;
import com.placement.entity.Role;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.entity.VerificationToken;
import com.placement.exception.ApiException;
import com.placement.messaging.AuthEvent;
import com.placement.messaging.KafkaAuthEventPublisher;
import com.placement.messaging.payload.EventPayloads.*;
import com.placement.redis.RateLimitService;
import com.placement.repository.StudentProfileRepository;
import com.placement.repository.UserRepository;
import com.placement.repository.VerificationTokenRepository;
import com.placement.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int TOKEN_BYTES = 32;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final VerificationTokenRepository verificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final RateLimitService rateLimitService;
    private final KafkaAuthEventPublisher eventPublisher;

    @Value("${app.email.verification-expiry-minutes:30}")
    private int verificationExpiryMinutes;

    @Value("${app.url:http://localhost:3001}")
    private String appUrl;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User user = User.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .role(Role.STUDENT)
                .active(true)
                .emailVerified(false)
                .build();
        user = userRepository.save(user);
        studentProfileRepository.save(StudentProfile.builder().user(user).build());

        eventPublisher.publishAuthEvent(AuthEvent.of(
                AuthEvent.TYPE_USER_REGISTERED,
                new UserRegistered(user.getId(), user.getEmail(), Instant.now())
        ));

        try {
            String rawToken = issueVerificationTokenInternal(user);
            emailService.sendVerificationEmail(user.getEmail(), rawToken, appUrl);
            eventPublisher.publishAuthEvent(AuthEvent.of(
                    AuthEvent.TYPE_EMAIL_VERIFICATION_REQUESTED,
                    new EmailVerificationRequested(user.getId(), user.getEmail(), Instant.now())
            ));
        } catch (Exception e) {
            log.warn("Failed to send initial verification email to {}: {}", user.getEmail(), e.getMessage());
        }

        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        } catch (Exception e) {
            throw new BadCredentialsException("Invalid email or password");
        }

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!user.isActive()) throw ApiException.forbidden("This account has been deactivated");

        eventPublisher.publishAuthEvent(AuthEvent.of(
                AuthEvent.TYPE_USER_LOGGED_IN,
                new UserLoggedIn(user.getId(), user.getEmail(), Instant.now())
        ));

        return buildAuthResponse(user);
    }

    public AuthResponse refresh(RefreshRequest request) {
        String token = request.refreshToken();
        if (!jwtUtil.isTokenParseable(token)) throw new ApiException("Invalid refresh token", HttpStatus.UNAUTHORIZED);
        if (!jwtUtil.isRefreshToken(token)) throw new ApiException("Invalid refresh token", HttpStatus.UNAUTHORIZED);
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.UNAUTHORIZED));
        if (!jwtUtil.isTokenValid(token, email)) throw new ApiException("Refresh token expired", HttpStatus.UNAUTHORIZED);
        return buildAuthResponse(user);
    }

    public UserResponse me(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> ApiException.notFound("User not found"));
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateName(String email, UpdateUserRequest request) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> ApiException.notFound("User not found"));
        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
            userRepository.save(user);
        }
        return toUserResponse(user);
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> ApiException.notFound("User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void resendVerification(ResendVerificationRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> ApiException.notFound("No account found for this email"));

        if (user.isEmailVerified()) {
            throw ApiException.badRequest("This email is already verified");
        }

        String rateLimitKey = "resend-verification:" + user.getEmail();
        if (!rateLimitService.tryAcquire(rateLimitKey, RESEND_COOLDOWN_SECONDS)) {
            throw ApiException.badRequest("Please wait " + RESEND_COOLDOWN_SECONDS + " seconds before requesting another email");
        }

        String rawToken = issueVerificationTokenInternal(user);
        emailService.sendVerificationEmail(user.getEmail(), rawToken, appUrl);
        eventPublisher.publishAuthEvent(AuthEvent.of(
                AuthEvent.TYPE_EMAIL_VERIFICATION_REQUESTED,
                new EmailVerificationRequested(user.getId(), user.getEmail(), Instant.now())
        ));
    }

    @Transactional
    public VerifyEmailResponse verifyEmail(String rawToken) {
        String tokenHash = hashToken(rawToken);
        VerificationToken token = verificationTokenRepository
                .findByTokenHashAndPurpose(tokenHash, VerificationTokenPurpose.EMAIL_VERIFICATION.name())
                .orElseThrow(() -> ApiException.badRequest("Invalid or expired verification link"));

        if (token.getUsedAt() != null) {
            throw ApiException.badRequest("This verification link has already been used");
        }
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw ApiException.badRequest("This verification link has expired");
        }

        token.setUsedAt(LocalDateTime.now());
        verificationTokenRepository.save(token);

        User user = token.getUser();
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            userRepository.save(user);
        }

        eventPublisher.publishAuthEvent(AuthEvent.of(
                AuthEvent.TYPE_EMAIL_VERIFIED,
                new EmailVerified(user.getId(), user.getEmail(), Instant.now())
        ));

        return new VerifyEmailResponse(true, "Email verified successfully", true);
    }

    @Transactional
    public AuthResponse completeRegistration(CompleteRegistrationRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> ApiException.notFound("No pending registration found for this email"));

        if (!user.isEmailVerified()) {
            throw ApiException.forbidden("Please verify your email before completing registration");
        }

        if (user.getFullName() == null || user.getFullName().isBlank()) {
            user.setFullName(request.fullName());
        }
        if (user.getPassword() == null || user.getPassword().isBlank() || user.getPassword().equals("OAUTH_NO_PASSWORD")) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        userRepository.save(user);

        return buildAuthResponse(user);
    }

    private String issueVerificationTokenInternal(User user) {
        byte[] rawBytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(rawBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes);
        String hash = hashToken(rawToken);

        VerificationToken vt = VerificationToken.builder()
                .user(user)
                .tokenHash(hash)
                .purpose(VerificationTokenPurpose.EMAIL_VERIFICATION.name())
                .expiresAt(LocalDateTime.now().plusMinutes(verificationExpiryMinutes))
                .build();
        verificationTokenRepository.save(vt);
        return rawToken;
    }

    static String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        String access = jwtUtil.generateAccessToken(user.getEmail(),
                Map.of("role", user.getRole().name(),
                        "userId", user.getId(),
                        "emailVerified", user.isEmailVerified()));
        String refresh = jwtUtil.generateRefreshToken(user.getEmail());
        return new AuthResponse(access, refresh, user.getId(), user.getEmail(),
                user.getFullName(), user.getRole().name(), user.isPremium(), user.isEmailVerified());
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(),
                user.getRole().name(), user.isActive(), user.isPremium(), user.isEmailVerified());
    }
}
