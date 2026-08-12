package com.app.orders.application.query;

import com.app.common.cqrs.Query;
import org.springframework.data.domain.Page;

import java.util.UUID;

public record ListOrdersQuery(UUID customerId, int page, int size) implements Query<Page<OrderSummaryView>> {}
