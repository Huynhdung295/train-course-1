package com.app.orders.application.saga.commands;

import java.util.UUID;

public record ReleaseStockCommand(UUID sagaId, UUID orderId) {}
