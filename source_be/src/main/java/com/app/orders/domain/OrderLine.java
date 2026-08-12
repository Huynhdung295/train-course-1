package com.app.orders.domain;

import com.app.common.domain.Money;
import java.util.UUID;

public record OrderLine(UUID productId, int quantity, Money price) {
}
