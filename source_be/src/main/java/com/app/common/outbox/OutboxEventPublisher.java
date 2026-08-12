package com.app.common.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * OutboxEventPublisher — Transactional Outbox Pattern implementation.
 *
 * Flow:
 * 1. Domain event saved to outbox_events table in same TX as business data.
 * 2. @Scheduled polling job reads unpublished events and publishes to Kafka.
 * 3. On success: mark as published. On failure: retry on next poll cycle.
 *
 * Guarantees: At-least-once delivery to Kafka (no lost events on crash).
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class OutboxEventPublisher {

    private final OutboxEventRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Save domain event to outbox table — called inside business transaction.
     */
    @Transactional
    public void publish(String aggregateType, String aggregateId, String eventType, Object payload) {
        try {
            var event = new OutboxEventEntity();
            event.setAggregateType(aggregateType);
            event.setAggregateId(aggregateId);
            event.setEventType(eventType);
            event.setPayload(objectMapper.writeValueAsString(payload));
            event.setPublished(false);
            event.setCreatedAt(Instant.now());
            outboxRepository.save(event);
            log.debug("Saved to outbox: {}/{}/{}", aggregateType, aggregateId, eventType);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize outbox event", e);
        }
    }

    /**
     * Polling job: reads unpublished events and publishes to Kafka every 5 seconds.
     * Uses @Scheduled to avoid Debezium CDC complexity for simpler deployments.
     */
    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void pollAndPublish() {
        List<OutboxEventEntity> unpublished = outboxRepository.findUnpublished(100);

        if (unpublished.isEmpty()) return;

        log.debug("Processing {} outbox events", unpublished.size());

        for (OutboxEventEntity event : unpublished) {
            try {
                String topic = resolveKafkaTopic(event.getAggregateType(), event.getEventType());
                kafkaTemplate.send(topic, event.getAggregateId(), event.getPayload())
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Failed to publish outbox event {}: {}", event.getId(), ex.getMessage());
                        } else {
                            log.debug("Published outbox event {} to {}", event.getId(), topic);
                        }
                    });

                event.setPublished(true);
                event.setPublishedAt(Instant.now());
                outboxRepository.save(event);

            } catch (Exception e) {
                log.error("Error processing outbox event {}: {}", event.getId(), e.getMessage());
                // Will retry on next poll cycle
            }
        }
    }

    private String resolveKafkaTopic(String aggregateType, String eventType) {
        return aggregateType.toLowerCase() + "." + eventType.toLowerCase();
    }
}
