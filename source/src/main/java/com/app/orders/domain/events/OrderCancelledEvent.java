package com.app.orders.domain.events;

import com.app.orders.domain.OrderId;

import java.time.Instant;

public record OrderCancelledEvent(
    OrderId orderId,
    String reason,
    Instant occurredAt
) implements OrderDomainEvent {}
