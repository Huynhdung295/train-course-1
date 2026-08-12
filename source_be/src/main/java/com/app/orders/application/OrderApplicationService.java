package com.app.orders.application;

import com.app.orders.application.command.ConfirmOrderCommand;
import com.app.orders.application.command.PlaceOrderCommand;
import com.app.orders.application.port.in.OrderUseCase;
import com.app.orders.application.port.out.OrderRepository;
import com.app.orders.application.port.out.PaymentGateway;
import com.app.orders.domain.Order;
import com.app.orders.domain.OrderId;
import com.app.orders.domain.OrderLine;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class OrderApplicationService implements OrderUseCase {

    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public OrderId placeOrder(PlaceOrderCommand cmd) {
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.price()))
            .toList();

        var order = Order.create(cmd.customerId(), lines);

        var payment = paymentGateway.charge(cmd.customerId(), order.calculateTotal());
        if (payment.failed()) {
            throw new RuntimeException("Payment failed: " + payment.reason());
        }

        orderRepository.save(order);

        order.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return order.getId();
    }

    @Override
    public void confirmOrder(ConfirmOrderCommand command) {
        var order = orderRepository.findById(command.orderId())
            .orElseThrow(() -> new RuntimeException("Order not found: " + command.orderId()));
            
        order.confirm();
        
        orderRepository.save(order);
        
        order.pullDomainEvents().forEach(eventPublisher::publishEvent);
    }
}
