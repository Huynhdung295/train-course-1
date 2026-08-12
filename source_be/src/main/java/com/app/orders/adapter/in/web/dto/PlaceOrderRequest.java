package com.app.orders.adapter.in.web.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PlaceOrderRequest(
    @NotNull UUID customerId,
    @NotEmpty List<OrderItemRequest> items
) {
    public record OrderItemRequest(
        @NotNull UUID productId,
        int quantity,
        @NotNull BigDecimal price,
        @NotNull String currency
    ) {}
}
