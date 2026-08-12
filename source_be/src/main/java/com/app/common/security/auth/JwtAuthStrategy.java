package com.app.common.security.auth;

import org.springframework.stereotype.Service;

@Service
public class JwtAuthStrategy implements AuthStrategy {
    @Override
    public String getType() {
        return "JWT";
    }

    @Override
    public boolean authenticate(String credentials) {
        // Implementation for JWT Auth
        return true;
    }
}
