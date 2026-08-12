package com.app.orders.adapter.in.web;

import com.app.common.domain.Money;
import com.app.orders.application.command.PlaceOrderCommand;
import com.app.orders.application.port.in.OrderUseCase;
import com.app.orders.adapter.in.web.dto.PlaceOrderRequest;
import com.app.orders.adapter.in.web.dto.OrderResponse;
import com.app.orders.domain.CustomerId;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderUseCase orderUseCase;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(@Valid @RequestBody PlaceOrderRequest request) {
        var items = request.items().stream()
            .map(item -> new PlaceOrderCommand.PlaceOrderItem(item.productId(), item.quantity(), Money.of(item.price(), item.currency())))
            .collect(Collectors.toList());
            
        var command = new PlaceOrderCommand(CustomerId.of(request.customerId()), items);
        
        var orderId = orderUseCase.placeOrder(command);
        return new OrderResponse(orderId.value());
    }
}
