package com.placement.config;

import com.placement.entity.OAuthIdentity;
import com.placement.entity.Role;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.messaging.AuthEvent;
import com.placement.messaging.KafkaAuthEventPublisher;
import com.placement.messaging.payload.EventPayloads;
import com.placement.repository.OAuthIdentityRepository;
import com.placement.repository.StudentProfileRepository;
import com.placement.repository.UserRepository;
import com.placement.security.JwtUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CustomOAuth2LoginSuccessHandler
        extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final OAuthIdentityRepository oauthIdentityRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final JwtUtil jwtUtil;
    private final KafkaAuthEventPublisher eventPublisher;

    @Value("${app.url:http://localhost:3001}")
    private String appUrl;

    @Override
    @Transactional
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        clearAuthenticationAttributes(request);

        OAuth2AuthenticationToken oauthToken =
                (OAuth2AuthenticationToken) authentication;

        String provider =
                oauthToken.getAuthorizedClientRegistrationId();

        OAuth2User oauthUser = oauthToken.getPrincipal();

        String providerAccountId =
                extractProviderAccountId(provider, oauthUser);

        String providerEmail =
                extractEmail(oauthUser);

        String providerName =
                extractName(oauthUser);

        log.info(
                "OAuth2 success: provider={} accountId={} email={}",
                provider,
                providerAccountId,
                providerEmail
        );

        if (providerAccountId == null || providerAccountId.isBlank()) {
            sendErrorRedirect(response, "OAuth account ID missing");
            return;
        }

        OAuthIdentity identity =
                oauthIdentityRepository
                        .findByProviderAndProviderAccountId(
                                provider,
                                providerAccountId
                        )
                        .orElse(null);

        User user;
        boolean isNewUser = false;
        boolean emailVerificationRequired = false;

        // ============================================================
        // EXISTING OAUTH ACCOUNT
        // ============================================================
        if (identity != null) {

            user = identity.getUser();

            if (!user.isActive()) {
                sendErrorRedirect(response, "Account deactivated");
                return;
            }

            if (providerEmail != null
                    && !providerEmail.isBlank()
                    && identity.getProviderEmail() == null) {

                identity.setProviderEmail(providerEmail);
                oauthIdentityRepository.save(identity);
            }

        } else {

            // ========================================================
            // NEW OAUTH ACCOUNT
            // ========================================================
            isNewUser = true;

            if (providerEmail != null
                    && !providerEmail.isBlank()
                    && userRepository.existsByEmail(providerEmail)) {

                user = userRepository
                        .findByEmail(providerEmail)
                        .orElseThrow(() ->
                                new IllegalStateException(
                                        "User exists but could not be loaded"
                                )
                        );

            } else {

                if (providerEmail == null
                        || providerEmail.isBlank()) {

                    emailVerificationRequired = true;

                    providerEmail =
                            "oauth-temp-"
                                    + provider
                                    + "-"
                                    + providerAccountId
                                    + "@prep2place.local";
                }

                user = User.builder()
                        .email(providerEmail)
                        .password("OAUTH_NO_PASSWORD")
                        .fullName(
                                providerName != null
                                        ? providerName
                                        : "OAuth User"
                        )
                        .role(Role.STUDENT)
                        .active(true)
                        .emailVerified(!emailVerificationRequired)
                        .build();

                user = userRepository.save(user);

                studentProfileRepository.save(
                        StudentProfile.builder()
                                .user(user)
                                .build()
                );

                eventPublisher.publishAuthEvent(
                        AuthEvent.of(
                                AuthEvent.TYPE_USER_REGISTERED,
                                new EventPayloads.UserRegistered(
                                        user.getId(),
                                        user.getEmail(),
                                        Instant.now()
                                )
                        )
                );
            }

            OAuthIdentity newIdentity =
                    OAuthIdentity.builder()
                            .user(user)
                            .provider(provider)
                            .providerAccountId(providerAccountId)
                            .providerEmail(providerEmail)
                            .build();

            oauthIdentityRepository.save(newIdentity);

            eventPublisher.publishAuthEvent(
                    AuthEvent.of(
                            AuthEvent.TYPE_OAUTH_ACCOUNT_LINKED,
                            new EventPayloads.OAuthAccountLinked(
                                    user.getId(),
                                    provider,
                                    providerAccountId,
                                    Instant.now()
                            )
                    )
            );
        }

        // ============================================================
        // LOGIN EVENT
        // ============================================================

        eventPublisher.publishAuthEvent(
                AuthEvent.of(
                        AuthEvent.TYPE_USER_LOGGED_IN,
                        new EventPayloads.UserLoggedIn(
                                user.getId(),
                                user.getEmail(),
                                Instant.now()
                        )
                )
        );

        // ============================================================
        // JWT
        // ============================================================

        String accessToken =
                jwtUtil.generateAccessToken(
                        user.getEmail(),
                        Map.of(
                                "role", user.getRole().name(),
                                "userId", user.getId(),
                                "emailVerified", user.isEmailVerified()
                        )
                );

        String refreshToken =
                jwtUtil.generateRefreshToken(user.getEmail());

        // ============================================================
        // FRONTEND CALLBACK
        // ============================================================

        String redirectUrl =
                UriComponentsBuilder
                        .fromUriString(
                                appUrl + "/oauth/callback"
                        )
                        .queryParam("accessToken", accessToken)
                        .queryParam("refreshToken", refreshToken)
                        .queryParam("userId", user.getId())
                        .queryParam("email", user.getEmail())
                        .queryParam(
                                "fullName",
                                URLEncoder.encode(
                                        user.getFullName(),
                                        StandardCharsets.UTF_8
                                )
                        )
                        .queryParam(
                                "role",
                                user.getRole().name()
                        )
                        .queryParam(
                                "premium",
                                user.isPremium()
                        )
                        .queryParam(
                                "emailVerified",
                                user.isEmailVerified()
                        )
                        .queryParam(
                                "isNewUser",
                                isNewUser
                        )
                        .queryParam(
                                "needsEmail",
                                emailVerificationRequired
                        )
                        .toUriString();

        response.addCookie(
                buildSessionCookie(accessToken)
        );

        getRedirectStrategy()
                .sendRedirect(
                        request,
                        response,
                        redirectUrl
                );
    }

    private String extractProviderAccountId(
            String provider,
            OAuth2User user) {

        if ("google".equalsIgnoreCase(provider)) {
            return user.getAttribute("sub");
        }

        if ("github".equalsIgnoreCase(provider)) {

            Object id = user.getAttribute("id");

            return id != null
                    ? id.toString()
                    : null;
        }

        return user.getName();
    }

    private String extractEmail(OAuth2User user) {

        Object email = user.getAttribute("email");

        if (email == null) {
            return null;
        }

        String value = email.toString().trim();

        return value.isBlank() ? null : value;
    }

    private String extractName(OAuth2User user) {

        Object name = user.getAttribute("name");

        if (name != null
                && !name.toString().isBlank()) {

            return name.toString();
        }

        Object login = user.getAttribute("login");

        if (login != null
                && !login.toString().isBlank()) {

            return login.toString();
        }

        return "OAuth User";
    }

    private Cookie buildSessionCookie(
            String accessToken) {

        Cookie cookie =
                new Cookie("pp_sid", accessToken);

        cookie.setPath("/");
        cookie.setHttpOnly(false);
        cookie.setMaxAge(3600);

        return cookie;
    }

    private void sendErrorRedirect(
            HttpServletResponse response,
            String error) throws IOException {

        String url =
                UriComponentsBuilder
                        .fromUriString(
                                appUrl + "/oauth/callback"
                        )
                        .queryParam(
                                "error",
                                URLEncoder.encode(
                                        error,
                                        StandardCharsets.UTF_8
                                )
                        )
                        .toUriString();

        response.sendRedirect(url);
    }
}