package com.app.orders.adapter.out.payment;

import com.app.common.domain.Money;
import com.app.orders.application.port.out.PaymentGateway;
import com.app.orders.application.port.out.PaymentResult;
import com.app.orders.domain.CustomerId;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class StripePaymentGatewayAdapter implements PaymentGateway {

    @Override
    public PaymentResult charge(CustomerId customerId, Money amount) {
        log.info("Mock charging {} {} to customer {}", amount.amount(), amount.currency(), customerId.value());
        return new PaymentResult(true, "Success");
    }
}
