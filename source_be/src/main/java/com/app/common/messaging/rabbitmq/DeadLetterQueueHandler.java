package com.app.common.messaging.rabbitmq;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * DeadLetterQueueHandler — Monitors and processes messages in the Dead Letter Queue.
 *
 * Messages land in DLQ when:
 * - Consumer throws exception after all retries
 * - Message TTL expires in main queue
 * - Consumer rejects message without requeue
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class DeadLetterQueueHandler {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Consume messages from DLQ for inspection / alerting.
     * In production: alert to Slack/PagerDuty, store in DB for manual replay.
     */
    @RabbitListener(queues = RabbitMQConfig.ORDER_DLQ)
    public void handleDeadLetter(Message message) {
        String body = new String(message.getBody());
        String originalQueue = (String) message.getMessageProperties()
            .getHeaders().get("x-first-death-queue");
        String deathReason = (String) message.getMessageProperties()
            .getHeaders().get("x-first-death-reason");

        log.error("DLQ message received — originalQueue={}, reason={}, body={}",
            originalQueue, deathReason, body);

        // NOTE: In production — alert to monitoring system, save to failed_events table
        // for manual inspection / replay
    }

    /**
     * Replay a failed message: manually re-publish to original exchange.
     */
    public void replayFromDlq(String routingKey, Object payload) {
        log.info("Replaying DLQ message with routingKey: {}", routingKey);
        rabbitTemplate.convertAndSend(RabbitMQConfig.ORDER_EXCHANGE, routingKey, payload);
    }
}
