package com.app.orders.application.query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderDetailView(
    UUID orderId,
    UUID customerId,
    String customerName,
    String customerEmail,
    String status,
    BigDecimal totalAmount,
    Instant placedAt,
    Instant lastUpdatedAt
) {}
