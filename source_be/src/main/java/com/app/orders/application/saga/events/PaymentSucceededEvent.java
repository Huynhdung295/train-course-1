package com.app.orders.application.saga.events;

import java.util.UUID;

public record PaymentSucceededEvent(UUID sagaId, UUID orderId) implements PaymentEvent {}
