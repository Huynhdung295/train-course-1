package com.app.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserDto {
    @NotBlank(message = "Username is required")
    private String username;

    @Email(message = "Invalid email format")
    private String email;
}
