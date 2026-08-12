package com.app.orders.application.saga.commands;

import com.app.orders.application.command.PlaceOrderCommand.PlaceOrderItem;

import java.util.List;
import java.util.UUID;

public record ReserveStockCommand(UUID sagaId, UUID orderId, List<PlaceOrderItem> items) {}
