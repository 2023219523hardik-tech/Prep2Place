package com.placement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public enum VerificationTokenPurpose {
        EMAIL_VERIFICATION
    }

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String password,
            @NotBlank String fullName
    ) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            Long userId,
            String email,
            String fullName,
            String role,
            boolean premium,
            boolean emailVerified
    ) {}

    public record UserResponse(Long id, String email, String fullName, String role, boolean active, boolean premium, boolean emailVerified) {}

    public record UpdateUserRequest(String fullName) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String newPassword
    ) {}

    public record ResendVerificationRequest(@NotBlank @Email String email) {}

    public record VerifyEmailResponse(boolean success, String message, boolean emailVerified) {}

    public record CompleteRegistrationRequest(
            @NotBlank @Email String email,
            @NotBlank String fullName,
            @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String password
    ) {}
}
