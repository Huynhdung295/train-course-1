package com.app.common.database.dto;

import com.app.common.database.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

import java.util.UUID;

public record OrderSummary(UUID id, OrderStatus status, BigDecimal totalAmount, Instant placedAt) {}
