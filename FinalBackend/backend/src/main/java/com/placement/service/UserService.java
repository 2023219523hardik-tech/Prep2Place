package com.placement.service;

import com.placement.dto.AuthDtos.UpdateUserRequest;
import com.placement.dto.AuthDtos.UserResponse;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public UserResponse getUser(Long userId) {
        return toResponse(userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found")));
    }

    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        if (request.fullName() != null && !request.fullName().isBlank()) user.setFullName(request.fullName());
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void deactivateUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        user.setActive(false);
        userRepository.save(user);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.isActive(), user.isPremium(), user.isEmailVerified());
    }
}
