package com.app.inventory.internal;

import com.app.inventory.InventoryManagement;
import com.app.orders.domain.events.OrderConfirmedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class OrderEventListener {

    private final InventoryManagement inventory;

    @ApplicationModuleListener
    void on(OrderConfirmedEvent event) {
        log.info("Received OrderConfirmedEvent for order {}", event.orderId().value());
        // For demonstration, we assume we know the items or we fetch them from orders module API
        // Normally, the event might contain the items. 
        log.info("Stock would be reserved here.");
    }
}
