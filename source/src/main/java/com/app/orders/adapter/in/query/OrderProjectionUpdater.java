package com.app.orders.adapter.in.query;

import com.app.orders.adapter.out.persistence.query.OrderReadModel;
import com.app.orders.adapter.out.persistence.query.OrderReadRepository;
import com.app.orders.domain.events.OrderPlacedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class OrderProjectionUpdater {

    private final OrderReadRepository readRepo;

    @KafkaListener(topics = "order-events", groupId = "read-model-projector")
    @Transactional
    public void on(OrderPlacedEvent event, Acknowledgment ack) {
        try {
            var readModel = new OrderReadModel();
            readModel.setId(event.orderId().value());
            readModel.setCustomerId(event.customerId().value());
            // Normally we'd call a customer service here to fetch name/email to denormalize
            readModel.setCustomerName("Denormalized Customer Name");
            readModel.setCustomerEmail("customer@company.com");
            readModel.setStatus("PENDING");
            
            var totalAmount = event.lines().stream()
                .map(l -> l.price().amount().multiply(BigDecimal.valueOf(l.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
                
            readModel.setTotalAmount(totalAmount);
            readModel.setPlacedAt(event.occurredAt());
            readModel.setLastUpdatedAt(Instant.now());

            readRepo.save(readModel);
            ack.acknowledge();

            log.debug("Projection updated for order {}", event.orderId().value());
        } catch (Exception e) {
            log.error("Failed to update projection for order {}", event.orderId().value(), e);
        }
    }
}
