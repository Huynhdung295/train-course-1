package com.app.orders.domain;

import com.app.common.domain.Money;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * OrderPricingService — Domain Service (DDD Tactical Pattern)
 * Business logic that doesn't naturally belong to a single entity.
 * No infrastructure dependencies — pure domain logic.
 */
@Service
@RequiredArgsConstructor
public class OrderPricingService {

    /**
     * Calculate final price after discount.
     * This crosses multiple domain concepts (Order total + Discount policy)
     * so it lives in a Domain Service rather than Order or DiscountPolicy alone.
     */
    public Money calculateFinalPrice(Order order, DiscountPolicy discountPolicy) {
        var baseTotal = order.calculateTotal();
        var discount = discountPolicy.calculate(baseTotal, order.getCustomerId());
        return baseTotal.subtract(discount);
    }
}
