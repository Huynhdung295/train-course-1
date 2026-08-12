package com.app.orders.domain.events;

import com.app.orders.domain.OrderId;

import java.time.Instant;

public sealed interface OrderDomainEvent
    permits OrderCreatedEvent, OrderConfirmedEvent, OrderCancelledEvent {

    OrderId orderId();
    Instant occurredAt();
}
