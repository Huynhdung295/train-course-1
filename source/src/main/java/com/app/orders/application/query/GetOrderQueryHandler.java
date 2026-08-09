package com.app.orders.application.query;

import com.app.common.cqrs.QueryHandler;
import com.app.orders.adapter.out.persistence.query.OrderReadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("getOrderHandler")
@Transactional(readOnly = true)
@RequiredArgsConstructor
@SuppressWarnings("all")
public class GetOrderQueryHandler implements QueryHandler<GetOrderQuery, OrderDetailView> {

    private final OrderReadRepository readRepo;

    @Override
    public OrderDetailView handle(GetOrderQuery query) {
        return readRepo.findById(query.orderId().value())
            .map(m -> new OrderDetailView(
                m.getId(),
                m.getCustomerId(),
                m.getCustomerName(),
                m.getCustomerEmail(),
                m.getStatus(),
                m.getTotalAmount(),
                m.getPlacedAt(),
                m.getLastUpdatedAt()
            ))
            .orElseThrow(() -> new RuntimeException("Order not found: " + query.orderId().value()));
    }
}
