package com.app.common.cache;

public class CacheLockInterruptedException extends RuntimeException {
    public CacheLockInterruptedException(String message, Throwable cause) {
        super(message, cause);
    }
}
