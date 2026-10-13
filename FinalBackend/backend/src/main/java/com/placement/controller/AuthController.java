package com.placement.controller;

import com.placement.dto.AuthDtos.*;
import com.placement.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request);
    }

    @PostMapping("/logout")
    public Map<String, String> logout() {
        return Map.of("message", "Logged out. Discard the stored tokens on the client.");
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return authService.me(authentication.getName());
    }

    @PutMapping("/me")
    public UserResponse updateMe(Authentication authentication, @RequestBody UpdateUserRequest request) {
        return authService.updateName(authentication.getName(), request);
    }

    @PostMapping("/change-password")
    public Map<String, String> changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(authentication.getName(), request);
        return Map.of("message", "Password updated");
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        authService.resendVerification(request);
        return ResponseEntity.ok(Map.of("message", "Verification email sent. Please check your inbox."));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<VerifyEmailResponse> verifyEmail(@RequestParam("token") String token) {
        VerifyEmailResponse response = authService.verifyEmail(token);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/complete-registration")
    public AuthResponse completeRegistration(@Valid @RequestBody CompleteRegistrationRequest request) {
        return authService.completeRegistration(request);
    }

    @GetMapping("/public")
    public Map<String, String> publicEndpoint() {
        return Map.of("status", "UP", "service", "auth", "timestamp", Instant.now().toString());
    }
}
