package com.app.users.controller;

import com.app.common.dto.ApiResponse;
import com.app.users.dto.UserDto;
import com.app.common.security.auth.AuthStrategyFactory;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthStrategyFactory authStrategyFactory;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserDto>> registerUser(@Valid @RequestBody UserDto request) {
        // Mock registration logic
        return ResponseEntity.ok(ApiResponse.success(request));
    }

    @PostMapping("/login/{strategyType}")
    public ResponseEntity<ApiResponse<String>> login(
            @PathVariable String strategyType, 
            @RequestBody String credentials) {
        
        // This is exactly the getLogicAuth pattern requested by the user
        boolean isAuthenticated = authStrategyFactory.getStrategy(strategyType).authenticate(credentials);
        
        if (isAuthenticated) {
            return ResponseEntity.ok(ApiResponse.success("Login Successful using " + strategyType));
        } else {
            throw new IllegalArgumentException("Invalid credentials");
        }
    }
}
