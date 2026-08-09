package com.app.orders.application.query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderSummaryView(
    UUID orderId,
    String customerName,
    String status,
    BigDecimal totalAmount,
    Instant placedAt
) {}
