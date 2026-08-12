package com.app.orders.adapter.out.persistence.mapper;

import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.entity.OrderStatus;
import com.app.orders.domain.Order;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", unmappedTargetPolicy = org.mapstruct.ReportingPolicy.IGNORE)
public interface OrderMapper {
    
    @Mapping(target = "id", expression = "java(domain.getId() != null ? domain.getId().value() : null)")
    @Mapping(target = "userId", expression = "java(domain.getCustomerId().value())")
    @Mapping(target = "status", expression = "java(mapStatus(domain.getStatus()))")
    @Mapping(target = "totalAmount", expression = "java(domain.calculateTotal().amount())")
    @Mapping(target = "currency", expression = "java(domain.calculateTotal().currency())")
    OrderJpaEntity toEntity(Order domain);
    
    default OrderStatus mapStatus(com.app.orders.domain.OrderStatus domainStatus) {
        if (domainStatus == null) return null;
        return OrderStatus.valueOf(domainStatus.name());
    }
    
    default com.app.orders.domain.OrderStatus mapDomainStatus(OrderStatus entityStatus) {
        if (entityStatus == null) return null;
        return com.app.orders.domain.OrderStatus.valueOf(entityStatus.name());
    }
}
