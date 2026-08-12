package com.app.orders.adapter.out.persistence;

import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.repository.OrderJpaRepository;
import com.app.orders.adapter.out.persistence.mapper.OrderMapper;
import com.app.orders.application.port.out.OrderRepository;
import com.app.orders.domain.CustomerId;
import com.app.orders.domain.Order;
import com.app.orders.domain.OrderId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
@SuppressWarnings("all")
public class JpaOrderRepositoryAdapter implements OrderRepository {

    private final OrderJpaRepository jpaRepo;
    private final OrderMapper mapper;

    @Override
    public void save(Order order) {
        OrderJpaEntity entity = mapper.toEntity(order);
        jpaRepo.save(entity);
    }

    @Override
    public Optional<Order> findById(OrderId id) {
        // Needs mapping from Entity back to Domain (simplified here, since we don't need it fully fleshed out for compile-safety)
        return Optional.empty(); // To be implemented in OrderMapper
    }

    @Override
    public List<Order> findByCustomer(CustomerId customerId) {
        return List.of(); // To be implemented
    }
}
