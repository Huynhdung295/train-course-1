package com.app.inventory;

import java.util.UUID;

public interface InventoryManagement {
    void reserveStock(UUID productId, int quantity);
}
