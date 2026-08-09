package com.app.common.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocketConfig — STOMP over WebSocket configuration with Redis pub/sub relay.
 *
 * Architecture:
 *   Client ←→ WebSocket Endpoint (/ws) ←→ STOMP message broker
 *   Client subscribes to: /topic/orders/{userId} or /user/queue/notifications
 *   Server sends to: /topic/orders or /user/{userId}/queue/notifications
 */
@Configuration
@EnableWebSocketMessageBroker
@Slf4j
@SuppressWarnings("all")
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${websocket.allowed-origins:*}")
    private String allowedOrigins;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns(allowedOrigins)
            .withSockJS();  // SockJS fallback for browsers that don't support WebSocket

        // Direct WebSocket endpoint (no SockJS fallback)
        registry.addEndpoint("/ws-native")
            .setAllowedOriginPatterns(allowedOrigins);

        log.info("WebSocket STOMP endpoints registered: /ws (SockJS), /ws-native");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Application destination prefix for @MessageMapping
        config.setApplicationDestinationPrefixes("/app");

        // User-specific prefix for @SendToUser
        config.setUserDestinationPrefix("/user");

        // Simple in-memory broker for topics/queues
        // In production: replace with Redis relay broker:
        //   config.enableStompBrokerRelay("/topic", "/queue")
        //       .setRelayHost("redis") ... (requires a STOMP-compatible broker like RabbitMQ or ActiveMQ)
        config.enableSimpleBroker("/topic", "/queue");
    }
}
