package com.app.orders.application.port.out;

import com.app.orders.domain.Order;
import com.app.orders.domain.CustomerId;
import com.app.orders.domain.OrderId;

import java.util.List;
import java.util.Optional;

public interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(OrderId id);
    List<Order> findByCustomer(CustomerId customerId);
}
