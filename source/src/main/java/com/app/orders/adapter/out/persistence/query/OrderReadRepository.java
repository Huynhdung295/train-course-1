package com.app.orders.adapter.out.persistence.query;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OrderReadRepository extends JpaRepository<OrderReadModel, UUID> {
}
