package com.app.orders.application.port.in;

import com.app.orders.application.command.ConfirmOrderCommand;
import com.app.orders.application.command.PlaceOrderCommand;
import com.app.orders.domain.OrderId;

public interface OrderUseCase {
    OrderId placeOrder(PlaceOrderCommand command);
    void confirmOrder(ConfirmOrderCommand command);
}
