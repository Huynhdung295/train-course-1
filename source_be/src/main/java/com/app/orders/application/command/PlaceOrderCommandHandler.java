package com.app.orders.application.command;

import com.app.common.cqrs.CommandHandler;
import com.app.orders.application.port.out.OrderRepository;
import com.app.orders.domain.Order;
import com.app.orders.domain.OrderId;
import com.app.orders.domain.OrderLine;
import com.app.orders.domain.events.OrderPlacedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service("placeOrderHandler")
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PlaceOrderCommandHandler implements CommandHandler<PlaceOrderCommand, OrderId> {

    private final OrderRepository orderRepo;
    private final ApplicationEventPublisher events;

    @Override
    public OrderId handle(PlaceOrderCommand cmd) {
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.price()))
            .toList();

        var order = Order.create(cmd.customerId(), lines);
        orderRepo.save(order);

        events.publishEvent(new OrderPlacedEvent(
            order.getId(),
            cmd.customerId(),
            lines,
            Instant.now()
        ));

        log.info("Order {} placed for customer {}", order.getId().value(), cmd.customerId().value());
        return order.getId();
    }
}
