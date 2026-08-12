package com.app.orders.domain.events;

import com.app.orders.domain.OrderId;

import java.time.Instant;
import java.util.UUID;

public record OrderConfirmedEvent(
    UUID eventId,
    Instant occurredAt,
    OrderId orderId
) implements OrderDomainEvent {

    public OrderConfirmedEvent(OrderId orderId) {
        this(UUID.randomUUID(), Instant.now(), orderId);
    }
}
