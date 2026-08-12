package com.app.orders.application.saga.commands;

import com.app.common.domain.Money;
import java.util.UUID;

public record ProcessPaymentCommand(UUID sagaId, UUID orderId, Money totalAmount) {}
