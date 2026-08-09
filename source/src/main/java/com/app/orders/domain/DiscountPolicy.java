package com.app.orders.domain;

import com.app.common.domain.Money;

/**
 * DiscountPolicy — Domain abstraction for different discount strategies.
 * Examples: NoDiscount, PercentageDiscount, VipCustomerDiscount, CouponDiscount
 */
@FunctionalInterface
public interface DiscountPolicy {
    Money calculate(Money baseTotal, CustomerId customerId);

    DiscountPolicy NO_DISCOUNT = (total, customerId) -> Money.ZERO;
}
