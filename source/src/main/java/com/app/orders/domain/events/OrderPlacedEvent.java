package com.app.orders.domain.events;

import com.app.orders.domain.CustomerId;
import com.app.orders.domain.OrderId;
import com.app.orders.domain.OrderLine;

import java.time.Instant;
import java.util.List;

public record OrderPlacedEvent(
    OrderId orderId,
    CustomerId customerId,
    List<OrderLine> lines,
    Instant occurredAt
) {}
