package com.app.orders.domain;

import java.util.UUID;

public record OrderId(UUID value) {
    public static OrderId generate() {
        return new OrderId(UUID.randomUUID());
    }
    
    public static OrderId of(String value) {
        return new OrderId(UUID.fromString(value));
    }
    
    public static OrderId of(UUID value) {
        return new OrderId(value);
    }
}
