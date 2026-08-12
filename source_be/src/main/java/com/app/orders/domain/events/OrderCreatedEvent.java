package com.app.orders.domain.events;

import com.app.orders.domain.CustomerId;
import com.app.orders.domain.OrderId;

import java.time.Instant;
import java.util.UUID;

public record OrderCreatedEvent(
    UUID eventId,
    Instant occurredAt,
    OrderId orderId,
    CustomerId customerId
) implements OrderDomainEvent {

    public OrderCreatedEvent(OrderId orderId, CustomerId customerId) {
        this(UUID.randomUUID(), Instant.now(), orderId, customerId);
    }
}
