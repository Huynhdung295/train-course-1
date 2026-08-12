package com.app.orders.application.port.out;

public record PaymentResult(boolean successful, String reason) {
    public boolean failed() {
        return !successful;
    }
}
