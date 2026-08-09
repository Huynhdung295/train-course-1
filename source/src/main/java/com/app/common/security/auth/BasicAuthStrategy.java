package com.app.common.security.auth;

import org.springframework.stereotype.Service;

@Service
public class BasicAuthStrategy implements AuthStrategy {
    @Override
    public String getType() {
        return "BASIC";
    }

    @Override
    public boolean authenticate(String credentials) {
        // Implementation for Basic Auth
        return true;
    }
}
