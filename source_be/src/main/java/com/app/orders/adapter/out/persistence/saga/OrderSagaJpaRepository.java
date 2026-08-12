package com.app.orders.adapter.out.persistence.saga;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OrderSagaJpaRepository extends JpaRepository<OrderSagaJpaEntity, UUID> {
}
