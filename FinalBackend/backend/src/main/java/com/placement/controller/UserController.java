package com.placement.controller;

import com.placement.dto.AuthDtos.*;
import com.placement.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{userId}")
    public UserResponse get(@PathVariable Long userId) { return userService.getUser(userId); }

    @PutMapping("/{userId}")
    public UserResponse update(@PathVariable Long userId, @RequestBody UpdateUserRequest request) {
        return userService.updateUser(userId, request);
    }

    @DeleteMapping("/{userId}")
    public java.util.Map<String, String> delete(@PathVariable Long userId) {
        userService.deactivateUser(userId);
        return java.util.Map.of("message", "Account deactivated");
    }
}
