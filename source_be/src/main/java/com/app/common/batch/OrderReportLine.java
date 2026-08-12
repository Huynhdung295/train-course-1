package com.app.common.batch;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * OrderReportLine — DTO for batch report output.
 */
public record OrderReportLine(
    String orderId,
    String userId,
    BigDecimal totalAmount,
    String status,
    Instant placedAt
) {}
