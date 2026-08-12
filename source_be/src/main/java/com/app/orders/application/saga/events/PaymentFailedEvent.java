package com.app.orders.application.saga.events;

import java.util.UUID;

public record PaymentFailedEvent(UUID sagaId, UUID orderId, String reason) implements PaymentEvent {}
