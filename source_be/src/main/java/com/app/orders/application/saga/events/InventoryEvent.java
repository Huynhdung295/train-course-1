package com.app.orders.application.saga.events;

import java.util.UUID;

public interface InventoryEvent {
    UUID sagaId();
}
