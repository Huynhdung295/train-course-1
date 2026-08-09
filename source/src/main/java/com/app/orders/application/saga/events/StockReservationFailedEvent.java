package com.app.orders.application.saga.events;

import java.util.UUID;

public record StockReservationFailedEvent(UUID sagaId, UUID orderId, String reason) implements InventoryEvent {}
