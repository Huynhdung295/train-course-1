package com.app.orders.application.query;

import com.app.common.cqrs.QueryHandler;
import com.app.orders.adapter.out.persistence.query.OrderReadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("listOrdersHandler")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ListOrdersQueryHandler implements QueryHandler<ListOrdersQuery, Page<OrderSummaryView>> {

    private final OrderReadRepository readRepo;

    @Override
    public Page<OrderSummaryView> handle(ListOrdersQuery query) {
        var pageable = PageRequest.of(query.page(), query.size(),
            Sort.by(Sort.Direction.DESC, "placedAt"));

        return readRepo.findAll(pageable)
            .map(m -> new OrderSummaryView(
                m.getId(),
                m.getCustomerName(),
                m.getStatus(),
                m.getTotalAmount(),
                m.getPlacedAt()
            ));
    }
}
