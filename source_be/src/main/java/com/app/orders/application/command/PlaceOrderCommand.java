package com.app.orders.application.command;

import com.app.common.cqrs.Command;
import com.app.common.domain.Money;
import com.app.orders.domain.CustomerId;
import com.app.orders.domain.OrderId;

import java.util.List;
import java.util.UUID;

public record PlaceOrderCommand(CustomerId customerId, List<PlaceOrderItem> items) implements Command<OrderId> {
    public record PlaceOrderItem(UUID productId, int quantity, Money price) {}
}
