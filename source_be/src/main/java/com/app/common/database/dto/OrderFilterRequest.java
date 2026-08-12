package com.app.common.database.dto;

import com.app.common.database.entity.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderFilterRequest(
    UUID userId,
    List<OrderStatus> statuses,
    Instant fromDate,
    Instant toDate
) {}
