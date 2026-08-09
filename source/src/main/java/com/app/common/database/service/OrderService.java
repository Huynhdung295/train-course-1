package com.app.common.database.service;

import com.app.common.database.dto.OrderFilterRequest;
import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.repository.OrderJpaRepository;
import com.app.common.database.specification.OrderSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@SuppressWarnings("all")
public class OrderService {

    private final OrderJpaRepository orderRepo;

    public Page<OrderJpaEntity> findOrders(OrderFilterRequest filter, Pageable pageable) {
        var spec = Specification.where(OrderSpecifications.notDeleted())
            .and(OrderSpecifications.byUserId(filter.userId()))
            .and(OrderSpecifications.byStatus(filter.statuses()))
            .and(OrderSpecifications.placedBetween(filter.fromDate(), filter.toDate()));

        return orderRepo.findAll(spec, pageable);
    }
}
