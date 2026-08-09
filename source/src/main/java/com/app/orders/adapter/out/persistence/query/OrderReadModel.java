package com.app.orders.adapter.out.persistence.query;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_views")
@Getter
@Setter
public class OrderReadModel {
    @Id
    private UUID id;
    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String status;
    private BigDecimal totalAmount;
    private Instant placedAt;
    private Instant lastUpdatedAt;
}
