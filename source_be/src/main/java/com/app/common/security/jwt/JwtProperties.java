package com.app.common.security.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;

@ConfigurationProperties(prefix = "app.security.jwt")
@Validated
public record JwtProperties(
    @NotBlank String accessTokenSecret,
    @NotBlank String refreshTokenSecret,
    @NotNull Duration accessTokenExpiry,
    @NotNull Duration refreshTokenExpiry,
    @NotBlank String issuer,
    @NotBlank String audience
) {}
