package com.app.orders.adapter.out.persistence.saga;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_sagas")
@Getter
@Setter
@NoArgsConstructor
public class OrderSagaJpaEntity {

    @Id
    private UUID sagaId;

    private UUID orderId;

    @Enumerated(EnumType.STRING)
    private OrderSagaState state;

    private String failureReason;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public OrderSagaJpaEntity(UUID sagaId, UUID orderId, OrderSagaState state) {
        this.sagaId = sagaId;
        this.orderId = orderId;
        this.state = state;
    }

    public void stockReserved() {
        assertState(OrderSagaState.STOCK_RESERVING);
        this.state = OrderSagaState.STOCK_RESERVED;
    }

    public void paymentProcessed() {
        assertState(OrderSagaState.PAYMENT_PROCESSING);
        this.state = OrderSagaState.PAYMENT_PROCESSED;
    }

    public void fail(String reason) {
        this.failureReason = reason;
        this.state = OrderSagaState.FAILED;
    }

    private void assertState(OrderSagaState expected) {
        if (this.state != expected) {
            throw new IllegalStateException("Invalid Saga state transition from " + state + " to " + expected);
        }
    }
}
