package com.app.orders.application.saga.events;

import com.app.common.domain.Money;
import java.util.UUID;

public record StockReservedEvent(UUID sagaId, UUID orderId, Money totalAmount) implements InventoryEvent {}
