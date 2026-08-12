package com.app.inventory.internal;

import com.app.inventory.InventoryManagement;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class InventoryService implements InventoryManagement {

    @Override
    public void reserveStock(UUID productId, int quantity) {
        log.info("Reserved {} units of product {}", quantity, productId);
    }
}
