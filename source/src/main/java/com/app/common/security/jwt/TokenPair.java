package com.app.common.security.jwt;

import java.time.Duration;

public record TokenPair(String accessToken, String refreshToken, Duration expiresIn) {}
