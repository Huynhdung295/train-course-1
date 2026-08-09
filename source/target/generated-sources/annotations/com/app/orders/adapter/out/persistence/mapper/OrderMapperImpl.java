package com.app.orders.adapter.out.persistence.mapper;

import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.entity.OrderLineJpaEntity;
import com.app.common.database.entity.ShippingAddressEmbeddable;
import com.app.orders.domain.Address;
import com.app.orders.domain.Order;
import com.app.orders.domain.OrderLine;
import java.util.ArrayList;
import java.util.List;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-08-09T22:52:18+0700",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.100.v20260624-0231, environment: Java 21.0.11 (Eclipse Adoptium)"
)
@Component
public class OrderMapperImpl implements OrderMapper {

    @Override
    public OrderJpaEntity toEntity(Order domain) {
        if ( domain == null ) {
            return null;
        }

        OrderJpaEntity orderJpaEntity = new OrderJpaEntity();

        orderJpaEntity.setConfirmedAt( domain.getConfirmedAt() );
        orderJpaEntity.setLines( orderLineListToOrderLineJpaEntityList( domain.getLines() ) );
        orderJpaEntity.setPlacedAt( domain.getPlacedAt() );
        orderJpaEntity.setShippingAddress( addressToShippingAddressEmbeddable( domain.getShippingAddress() ) );

        orderJpaEntity.setId( domain.getId() != null ? domain.getId().value() : null );
        orderJpaEntity.setUserId( domain.getCustomerId().value() );
        orderJpaEntity.setStatus( mapStatus(domain.getStatus()) );
        orderJpaEntity.setTotalAmount( domain.calculateTotal().amount() );
        orderJpaEntity.setCurrency( domain.calculateTotal().currency() );

        return orderJpaEntity;
    }

    protected OrderLineJpaEntity orderLineToOrderLineJpaEntity(OrderLine orderLine) {
        if ( orderLine == null ) {
            return null;
        }

        OrderLineJpaEntity orderLineJpaEntity = new OrderLineJpaEntity();

        orderLineJpaEntity.setProductId( orderLine.productId() );
        orderLineJpaEntity.setQuantity( orderLine.quantity() );

        return orderLineJpaEntity;
    }

    protected List<OrderLineJpaEntity> orderLineListToOrderLineJpaEntityList(List<OrderLine> list) {
        if ( list == null ) {
            return null;
        }

        List<OrderLineJpaEntity> list1 = new ArrayList<OrderLineJpaEntity>( list.size() );
        for ( OrderLine orderLine : list ) {
            list1.add( orderLineToOrderLineJpaEntity( orderLine ) );
        }

        return list1;
    }

    protected ShippingAddressEmbeddable addressToShippingAddressEmbeddable(Address address) {
        if ( address == null ) {
            return null;
        }

        ShippingAddressEmbeddable shippingAddressEmbeddable = new ShippingAddressEmbeddable();

        shippingAddressEmbeddable.setCity( address.city() );
        shippingAddressEmbeddable.setCountryCode( address.countryCode() );
        shippingAddressEmbeddable.setPostalCode( address.postalCode() );
        shippingAddressEmbeddable.setState( address.state() );
        shippingAddressEmbeddable.setStreet( address.street() );

        return shippingAddressEmbeddable;
    }
}
