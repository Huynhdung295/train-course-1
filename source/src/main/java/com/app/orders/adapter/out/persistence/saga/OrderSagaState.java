package com.app.orders.adapter.out.persistence.saga;

public enum OrderSagaState {
    PENDING,
    STOCK_RESERVING,
    STOCK_RESERVED,
    PAYMENT_PROCESSING,
    PAYMENT_PROCESSED,
    COMPLETED,
    STOCK_RELEASING,
    PAYMENT_REFUNDING,
    FAILED
}
