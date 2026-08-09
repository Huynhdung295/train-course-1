package com.app.orders.application.port.out;

import com.app.common.domain.Money;
import com.app.orders.domain.CustomerId;

public interface PaymentGateway {
    PaymentResult charge(CustomerId customerId, Money amount);
}
