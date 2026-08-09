package com.app.common.messaging.rabbitmq;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


/**
 * RabbitMQConfig — RabbitMQ exchanges, queues, and Dead Letter Queue configuration.
 *
 * Pattern:
 *   Main Exchange → Main Queue → Consumer
 *              ↓ (on failure after maxRetries)
 *   DLX Exchange → DLQ → Manual inspection / replay
 */
@Configuration
@Slf4j
@SuppressWarnings("all")
public class RabbitMQConfig {

    // Queue and exchange names
    public static final String ORDER_EXCHANGE      = "order.exchange";
    public static final String ORDER_QUEUE         = "order.queue";
    public static final String ORDER_DLX           = "order.dlx";
    public static final String ORDER_DLQ           = "order.dlq";
    public static final String NOTIFICATION_QUEUE  = "notification.queue";

    // ─── Message Converter ────────────────────────────────────────────────────

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        var template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        var factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setConcurrentConsumers(3);
        factory.setMaxConcurrentConsumers(10);
        factory.setDefaultRequeueRejected(false); // Don't re-queue on rejection → goes to DLQ
        return factory;
    }

    // ─── Dead Letter Exchange (DLX) ──────────────────────────────────────────

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(ORDER_DLX, true, false);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(ORDER_DLQ).build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue())
            .to(deadLetterExchange())
            .with(ORDER_DLQ);
    }

    // ─── Main Exchange and Queue (with DLX configured) ───────────────────────

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(ORDER_EXCHANGE, true, false);
    }

    /**
     * Main order queue with DLX configured.
     * When a message is rejected (nacked) or TTL expires → sent to DLX → DLQ
     */
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable(ORDER_QUEUE)
            .withArgument("x-dead-letter-exchange", ORDER_DLX)
            .withArgument("x-dead-letter-routing-key", ORDER_DLQ)
            .withArgument("x-message-ttl", 300_000)  // 5 minute TTL before DLQ
            .build();
    }

    @Bean
    public Binding orderQueueBinding() {
        return BindingBuilder.bind(orderQueue())
            .to(orderExchange())
            .with("order.#");  // Route all order.* routing keys to main queue
    }

    // ─── Notification Queue ───────────────────────────────────────────────────

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE)
            .withArgument("x-dead-letter-exchange", ORDER_DLX)
            .withArgument("x-dead-letter-routing-key", ORDER_DLQ)
            .build();
    }

    @Bean
    public Binding notificationBinding() {
        return BindingBuilder.bind(notificationQueue())
            .to(orderExchange())
            .with("notification.#");
    }
}
