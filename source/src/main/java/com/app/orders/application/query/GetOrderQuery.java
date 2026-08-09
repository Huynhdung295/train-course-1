package com.app.orders.application.query;

import com.app.common.cqrs.Query;
import com.app.orders.domain.OrderId;

public record GetOrderQuery(OrderId orderId) implements Query<OrderDetailView> {}
