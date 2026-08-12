package com.app.common.event;

import java.util.UUID;

public record OrderCreatedEvent(UUID orderId, UUID userId) {
}
