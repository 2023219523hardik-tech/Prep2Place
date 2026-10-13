package com.placement.controller;

import com.placement.dto.AdminDtos.AdminLoginRequest;
import com.placement.dto.AuthDtos.AuthResponse;
import com.placement.dto.AuthDtos.LoginRequest;
import com.placement.dto.AuthDtos.UserResponse;
import com.placement.exception.ApiException;
import com.placement.service.AuthService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AuthService authService;
    private final CurrentUserService currentUserService;

    @PostMapping("/login")
    public AuthResponse login(@RequestBody AdminLoginRequest request) {
        AuthResponse response = authService.login(new LoginRequest(request.email(), request.password()));
        if (!response.role().equals("ADMIN") && !response.role().equals("PLACEMENT_ADMIN")) {
            throw new ApiException("This account does not have admin access", HttpStatus.FORBIDDEN);
        }
        return response;
    }

    @GetMapping("/me")
    public UserResponse me() {
        var user = currentUserService.getCurrentUser();
        return authService.me(user.getEmail());
    }

    @PostMapping("/logout")
    public java.util.Map<String, String> logout() {
        return java.util.Map.of("message", "Logged out. Discard the stored tokens on the client.");
    }
}
