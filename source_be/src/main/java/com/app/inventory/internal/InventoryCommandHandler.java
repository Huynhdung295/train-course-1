package com.app.inventory.internal;

import com.app.common.domain.Money;
import com.app.inventory.InventoryManagement;
import com.app.orders.application.saga.commands.ReserveStockCommand;
import com.app.orders.application.saga.events.StockReservationFailedEvent;
import com.app.orders.application.saga.events.StockReservedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class InventoryCommandHandler {

    private final InventoryManagement inventory;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "inventory-commands", groupId = "inventory-group")
    public void handleReserveStock(ReserveStockCommand cmd, Acknowledgment ack) {
        try {
            cmd.items().forEach(item -> {
                inventory.reserveStock(item.productId(), item.quantity());
            });

            var totalAmount = cmd.items().stream()
                .map(i -> i.price().amount().multiply(BigDecimal.valueOf(i.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            kafkaTemplate.send("inventory-events", cmd.orderId().toString(),
                new StockReservedEvent(cmd.sagaId(), cmd.orderId(), Money.of(totalAmount, "USD")));

        } catch (Exception e) {
            log.error("Stock reservation failed for order {}", cmd.orderId(), e);
            kafkaTemplate.send("inventory-events", cmd.orderId().toString(),
                new StockReservationFailedEvent(cmd.sagaId(), cmd.orderId(), e.getMessage()));
        }

        ack.acknowledge();
    }
}
