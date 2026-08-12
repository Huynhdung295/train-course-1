package com.app.common.security.auth;

public interface AuthStrategy {
    String getType();
    boolean authenticate(String credentials);
}
