package com.app.orders.domain;

import com.app.common.domain.Money;
import com.app.orders.domain.events.*;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Order — Aggregate Root (DDD Tactical Pattern)
 * - State changes only through business methods
 * - Accumulates Domain Events via pullDomainEvents()
 * - References other aggregates by ID only (CustomerId, ProductId)
 */
@SuppressWarnings("all")
public class Order {

    private final OrderId id;
    private final CustomerId customerId;
    private OrderStatus status;
    private final List<OrderLine> lines;
    private Address shippingAddress;
    private final Instant placedAt;
    private Instant confirmedAt;
    private Instant cancelledAt;
    private String cancellationReason;

    // Domain events accumulated during the aggregate's lifecycle
    private final List<OrderDomainEvent> domainEvents = new ArrayList<>();

    public Order(OrderId id, CustomerId customerId, OrderStatus status, List<OrderLine> lines) {
        this.id = id;
        this.customerId = customerId;
        this.status = status;
        this.lines = new ArrayList<>(lines);
        this.placedAt = Instant.now();
    }

    // ── Factory method ────────────────────────────────────
    public static Order create(CustomerId customerId, List<OrderLine> lines) {
        if (lines == null || lines.isEmpty()) {
            throw new IllegalArgumentException("Order must have at least one line");
        }
        if (lines.size() > 50) {
            throw new IllegalArgumentException("Order cannot have more than 50 lines");
        }
        var order = new Order(OrderId.generate(), customerId, OrderStatus.PENDING, lines);
        order.domainEvents.add(new OrderCreatedEvent(order.id, customerId));
        return order;
    }

    // ── Business methods ──────────────────────────────────
    public void confirm() {
        if (this.status != OrderStatus.PENDING) {
            throw new IllegalStateException(
                "Cannot confirm order in state: " + this.status);
        }
        this.status = OrderStatus.CONFIRMED;
        this.confirmedAt = Instant.now();
        this.domainEvents.add(new OrderConfirmedEvent(this.id));
    }

    public void cancel(String reason) {
        if (status == OrderStatus.SHIPPED || status == OrderStatus.DELIVERED) {
            throw new IllegalStateException("Cannot cancel a shipped or delivered order");
        }
        this.status = OrderStatus.CANCELLED;
        this.cancellationReason = reason;
        this.cancelledAt = Instant.now();
        this.domainEvents.add(new OrderCancelledEvent(id, reason, cancelledAt));
    }

    public void updateShippingAddress(Address newAddress) {
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("Cannot update address of a confirmed order");
        }
        this.shippingAddress = newAddress;
    }

    // ── Domain queries ────────────────────────────────────
    public Money calculateTotal() {
        return lines.stream()
            .map(line -> line.price().multiply(line.quantity()))
            .reduce(Money.ZERO, Money::add);
    }

    public boolean isEligibleForReturn() {
        return status == OrderStatus.DELIVERED
            && confirmedAt != null
            && Duration.between(confirmedAt, Instant.now()).toDays() <= 30;
    }

    // ── Event management ──────────────────────────────────
    public List<OrderDomainEvent> pullDomainEvents() {
        var events = List.copyOf(this.domainEvents);
        this.domainEvents.clear();
        return events;
    }

    // ── Getters (no setters — state changes via business methods only) ──
    public OrderId getId() { return id; }
    public CustomerId getCustomerId() { return customerId; }
    public OrderStatus getStatus() { return status; }
    public Address getShippingAddress() { return shippingAddress; }
    public Instant getPlacedAt() { return placedAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public String getCancellationReason() { return cancellationReason; }
    public List<OrderLine> getLines() { return Collections.unmodifiableList(lines); }
}
