package com.app.common.event;

import java.time.Instant;
import java.util.UUID;

/**
 * DomainEvent — Marker interface for all Domain Events in the system.
 *
 * Domain Events represent something meaningful that happened in the domain.
 * They are published AFTER the transaction commits via Spring Modulith,
 * ensuring the event is only dispatched when the state change is durable.
 *
 * Naming Convention: Past tense (e.g., OrderPlacedEvent, PaymentProcessedEvent)
 *
 * Example:
 *   public record OrderPlacedEvent(UUID orderId, UUID tenantId, Instant occurredAt)
 *       implements DomainEvent {}
 */
public interface DomainEvent {

    /**
     * The ID of the aggregate that raised this event.
     */
    UUID aggregateId();

    /**
     * When this event occurred (for event sourcing / audit trail).
     */
    Instant occurredAt();
}
