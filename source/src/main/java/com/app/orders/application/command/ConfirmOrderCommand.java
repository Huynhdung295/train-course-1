package com.app.orders.application.command;

import com.app.orders.domain.OrderId;

public record ConfirmOrderCommand(OrderId orderId) {}
