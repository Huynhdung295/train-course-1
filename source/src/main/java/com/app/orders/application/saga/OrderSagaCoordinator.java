package com.app.orders.application.saga;

import com.app.orders.adapter.out.persistence.saga.OrderSagaJpaEntity;
import com.app.orders.adapter.out.persistence.saga.OrderSagaJpaRepository;
import com.app.orders.adapter.out.persistence.saga.OrderSagaState;
import com.app.orders.application.command.PlaceOrderCommand;
import com.app.orders.application.port.out.OrderRepository;
import com.app.orders.application.saga.commands.ProcessPaymentCommand;
import com.app.orders.application.saga.commands.ReleaseStockCommand;
import com.app.orders.application.saga.commands.ReserveStockCommand;
import com.app.orders.application.saga.events.*;
import com.app.orders.domain.Order;
import com.app.orders.domain.OrderId;
import com.app.orders.domain.OrderLine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class OrderSagaCoordinator {

    private final OrderRepository orderRepo;
    private final OrderSagaJpaRepository sagaRepo;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public OrderId startSaga(PlaceOrderCommand cmd) {
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.price()))
            .toList();
            
        var order = Order.create(cmd.customerId(), lines);
        orderRepo.save(order);

        var saga = new OrderSagaJpaEntity(UUID.randomUUID(), order.getId().value(), OrderSagaState.PENDING);
        sagaRepo.save(saga);

        var reserveCmd = new ReserveStockCommand(saga.getSagaId(), order.getId().value(), cmd.items());
        kafkaTemplate.send("inventory-commands", order.getId().value().toString(), reserveCmd);

        saga.setState(OrderSagaState.STOCK_RESERVING);
        sagaRepo.save(saga);

        log.info("Saga {} started for order {}", saga.getSagaId(), order.getId().value());
        return order.getId();
    }

    @KafkaListener(topics = "inventory-events", groupId = "order-saga-group")
    public void onInventoryEvent(InventoryEvent event, Acknowledgment ack) {
        var saga = sagaRepo.findById(event.sagaId())
            .orElseThrow(() -> new RuntimeException("Saga not found: " + event.sagaId()));

        if (event instanceof StockReservedEvent reserved) {
            saga.stockReserved();
            sagaRepo.save(saga);

            var payCmd = new ProcessPaymentCommand(
                saga.getSagaId(), saga.getOrderId(), reserved.totalAmount()
            );
            kafkaTemplate.send("payment-commands", saga.getOrderId().toString(), payCmd);
            saga.setState(OrderSagaState.PAYMENT_PROCESSING);
            sagaRepo.save(saga);

        } else if (event instanceof StockReservationFailedEvent failed) {
            saga.fail(failed.reason());
            sagaRepo.save(saga);
            // Cancel order logic here (requires port/use case method)
            log.warn("Saga {} failed at stock reservation: {}", saga.getSagaId(), failed.reason());
        }

        ack.acknowledge();
    }

    @KafkaListener(topics = "payment-events", groupId = "order-saga-group")
    public void onPaymentEvent(PaymentEvent event, Acknowledgment ack) {
        var saga = sagaRepo.findById(event.sagaId())
            .orElseThrow(() -> new RuntimeException("Saga not found: " + event.sagaId()));

        if (event instanceof PaymentSucceededEvent) {
            saga.paymentProcessed();
            saga.setState(OrderSagaState.COMPLETED);
            sagaRepo.save(saga);

            orderRepo.findById(OrderId.of(saga.getOrderId())).ifPresent(order -> {
                order.confirm();
                orderRepo.save(order);
            });
            log.info("Saga {} completed successfully", saga.getSagaId());

        } else if (event instanceof PaymentFailedEvent failed) {
            saga.fail(failed.reason());
            sagaRepo.save(saga);

            var releaseCmd = new ReleaseStockCommand(saga.getSagaId(), saga.getOrderId());
            kafkaTemplate.send("inventory-commands", saga.getOrderId().toString(), releaseCmd);
            saga.setState(OrderSagaState.STOCK_RELEASING);
            sagaRepo.save(saga);

            log.warn("Saga {} failed at payment, releasing stock", saga.getSagaId());
        }

        ack.acknowledge();
    }
}
