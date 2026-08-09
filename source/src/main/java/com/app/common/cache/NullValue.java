package com.app.common.cache;

import java.io.Serializable;

/**
 * NullValue — Sentinel value for null caching to prevent Cache Penetration.
 */
public final class NullValue implements Serializable {
    public static final NullValue INSTANCE = new NullValue();
    
    private NullValue() {}
    
    @Override
    public String toString() {
        return "NullValue";
    }
}
