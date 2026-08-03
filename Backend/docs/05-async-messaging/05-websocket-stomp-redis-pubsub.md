# 🔌 WebSockets, STOMP & Redis Pub/Sub

> **Category**: Async & Messaging | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Redis**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The WebSocket Scaling Problem
WebSockets maintain stateful, persistent TCP connections. 
If User A connects to **Node 1** and User B connects to **Node 2**:
- If User A sends a chat message to User B, Node 1 receives the message.
- Node 1 cannot send the message to User B because Node 1 does not hold User B's WebSocket session (Node 2 does).
- **Solution**: We need a central message bus to broadcast WebSocket messages across the cluster.

### STOMP (Simple Text Oriented Messaging Protocol)
Raw WebSockets are just TCP frames (binary or text). They lack routing (no topics, queues, or headers).
STOMP adds standard HTTP-like semantics to WebSockets:
- Clients SUBSCRIBE to `/topic/chat.123`
- Server SENDs to `/topic/chat.123`

### The Redis Pub/Sub Broker Relay
While Spring provides an in-memory SimpleBroker for STOMP, it only works for a single JVM.
To scale out, we replace the SimpleBroker with a **BrokerRelay** backed by RabbitMQ, OR we manually use **Redis Pub/Sub** to broadcast server-side messages to all nodes, and each node pushes to its locally connected WebSockets.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-integration](https://github.com/spring-projects/spring-integration)** — Enterprise integration patterns.
- **[stomp-js/stompjs](https://github.com/stomp-js/stompjs)** — The standard frontend client for STOMP.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Spring WebSockets -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>

<!-- Redis for cluster pub/sub -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- Spring Security Messaging (for securing STOMP topics) -->
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-messaging</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: 6379
```

---

## 📐 System Design Blueprint

### Complete Scalable WebSocket Architecture

```java
// ═══════════════════════════════════════════════════
// 1. WEBSOCKET & STOMP CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // The HTTP endpoint the JS client uses to establish the WebSocket handshake
        registry.addEndpoint("/ws/v1")
                .setAllowedOriginPatterns("https://*.mycompany.com")
                .withSockJS(); // Fallback for browsers that don't support WebSockets
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Destination prefixes for messages bound for @MessageMapping methods in controllers
        registry.setApplicationDestinationPrefixes("/app");
        
        // Use SimpleBroker for local dispatch to connected clients.
        // We will bridge multiple JVMs manually using Redis Pub/Sub.
        registry.enableSimpleBroker("/topic", "/queue");
        
        // Prefix used for specific user targeting (e.g., /user/{username}/queue/notifications)
        registry.setUserDestinationPrefix("/user");
    }
}

// ═══════════════════════════════════════════════════
// 2. REDIS PUB/SUB CONFIGURATION (The Cluster Bridge)
// ═══════════════════════════════════════════════════

@Configuration
public class RedisPubSubConfig {

    public static final String WS_CLUSTER_TOPIC = "ws:cluster:broadcast";

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter listenerAdapter) {
            
        var container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        // Subscribe to the Redis topic
        container.addMessageListener(listenerAdapter, new ChannelTopic(WS_CLUSTER_TOPIC));
        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(RedisWebSocketBridge receiver) {
        // When a message hits Redis, call 'receiveMessage' on our bridge bean
        return new MessageListenerAdapter(receiver, "receiveMessage");
    }
}

// ═══════════════════════════════════════════════════
// 3. THE REDIS TO WEBSOCKET BRIDGE
// ═══════════════════════════════════════════════════

public record ClusterMessage(String targetTopic, Object payload) {}

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisWebSocketBridge {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Called by RedisMessageListenerContainer when ANY node publishes to Redis.
     */
    public void receiveMessage(String messageJson) {
        try {
            var message = objectMapper.readValue(messageJson, ClusterMessage.class);
            log.debug("Received cluster broadcast for topic: {}", message.targetTopic());
            
            // Push to local WebSockets connected to THIS JVM
            messagingTemplate.convertAndSend(message.targetTopic(), message.payload());
            
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize cluster WS message", e);
        }
    }
}

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Publishes a message to ALL users across ALL JVM nodes.
     */
    public void broadcastToAll(String text) throws JsonProcessingException {
        var payload = Map.of("content", text, "timestamp", Instant.now());
        var message = new ClusterMessage("/topic/announcements", payload);
        
        // Send to Redis. Redis will broadcast to all JVMs.
        // Each JVM will then send to its local WebSockets.
        redisTemplate.convertAndSend(
            RedisPubSubConfig.WS_CLUSTER_TOPIC, 
            objectMapper.writeValueAsString(message)
        );
    }
}

// ═══════════════════════════════════════════════════
// 4. WEBSOCKET CONTROLLER (Receiving from Client)
// ═══════════════════════════════════════════════════

@Controller
@Slf4j
public class ChatController {

    // Handled when client sends STOMP frame to /app/chat.send
    @MessageMapping("/chat.send")
    public void handleClientMessage(
            @Payload ChatMessage message, 
            SimpMessageHeaderAccessor headerAccessor) {
            
        var username = headerAccessor.getUser().getName();
        log.info("Received message from {}", username);
        
        // Process message, save to DB, then broadcast via Redis to the cluster...
    }
}

// ═══════════════════════════════════════════════════
// 5. JWT SECURITY INTERCEPTOR
// ═══════════════════════════════════════════════════

@Configuration
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketSecurityConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                
                // On CONNECT, extract JWT from STOMP header
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        // validate token, parse Authentication, set in accessor
                        // accessor.setUser(authentication);
                    }
                }
                return message;
            }
        });
    }
}
```

---

## 🧪 Verification Commands

```powershell
# You need a STOMP client to test WebSockets effectively.
# Below is a vanilla JavaScript snippet to test the connection:

@"
const stompClient = new StompJs.Client({
    brokerURL: 'ws://localhost:8080/ws/v1',
    connectHeaders: {
        Authorization: 'Bearer YOUR_JWT_TOKEN'
    },
    debug: function (str) { console.log(str); },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
});

stompClient.onConnect = function (frame) {
    stompClient.subscribe('/topic/announcements', function (message) {
        console.log('Received: ' + message.body);
    });
};

stompClient.activate();
"@
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always use STOMP over raw WebSockets**. Implementing custom JSON framing, topics, routing, and heartbeats over raw WebSockets is reinventing the wheel.
2. **Bridge JVMs via Redis**. If you load balance across 3 instances, you must bridge them so events sent to Instance A reach clients on Instance B.
3. **Pass JWT in STOMP headers on CONNECT**. WebSockets cannot easily send standard HTTP headers (like `Authorization`) during the initial browser upgrade handshake. Send the JWT in the STOMP `CONNECT` frame instead.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| In-memory `SimpleBroker` in a cluster | Server A sends event, but client is connected to Server B. Client receives nothing. | Use Redis PubSub relay or full RabbitMQ STOMP broker. |
| Depending on HTTP Session (Cookies) for Auth | Modern APIs are stateless (JWT). WS connections often fail CSRF and session checks. | Use `ChannelInterceptor` to parse JWT from the STOMP CONNECT frame. |
| Assuming guaranteed delivery | WebSockets can drop silently. | Client must implement reconnection logic and fetch missed state via standard REST API on reconnect. |
