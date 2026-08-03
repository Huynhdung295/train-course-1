# 📡 Server-Sent Events (SSE) with Reactive WebFlux

> **Category**: Async & Messaging | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **WebFlux**

---

## 📖 Core Technical Mechanics & Deep-Dive

### SSE vs WebSockets
- **WebSockets**: Bi-directional, full-duplex. Requires custom protocol (STOMP) or manual framing. Difficult to load balance (sticky sessions often required).
- **Server-Sent Events (SSE)**: Uni-directional (Server → Client). Standard HTTP/1.1 protocol (`text/event-stream`). Built-in browser API (`EventSource`). Works perfectly through proxies, firewalls, and standard HTTP load balancers without sticky sessions. Automatic reconnection built-in.

### Reactive Streams (WebFlux)
To keep an HTTP connection open indefinitely and push data, standard Spring WebMVC (which assigns 1 thread per request) would quickly exhaust the thread pool.
**Spring WebFlux** (Project Reactor) allows returning a `Flux<T>` which pushes data asynchronously without tying up an OS thread, making it perfect for SSE.

*Note: With Java 21 Virtual Threads, you can also do SSE in Spring WebMVC using `SseEmitter` without OS thread exhaustion, but `Flux<ServerSentEvent>` provides much richer functional operators (filtering, mapping, windowing, backpressure).*

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-framework WebFlux](https://github.com/spring-projects/spring-framework/tree/main/spring-webflux)** — Core reactive framework.
- **[reactor/reactor-core](https://github.com/reactor/reactor-core)** — The engine behind `Flux` and `Mono`.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Spring WebFlux -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```
*Note: You can run WebFlux and WebMVC in the same application, but SSE endpoints should ideally return `Flux`.*

---

## 📐 System Design Blueprint

### Complete SSE Implementation

```java
// ═══════════════════════════════════════════════════
// 1. REACTIVE EVENT BUS (Sinks)
// ═══════════════════════════════════════════════════

@Service
@Slf4j
public class MarketDataStreamService {

    // Sinks.Many is a reactive event bus.
    // Multicast: broadcasts to all subscribers.
    // directBestEffort: If a subscriber is too slow, drop messages for THAT subscriber only (prevent memory leak).
    private final Sinks.Many<MarketPrice> priceSink = Sinks.many().multicast().directBestEffort();

    /**
     * Called by a Kafka Consumer or internal service to publish new prices.
     */
    public void publishPrice(MarketPrice price) {
        var result = priceSink.tryEmitNext(price);
        if (result.isFailure()) {
            log.debug("Failed to emit price. No subscribers or backpressure. Result: {}", result);
        }
    }

    /**
     * Returns the reactive stream of prices.
     */
    public Flux<MarketPrice> getPriceStream() {
        return priceSink.asFlux();
    }
}

public record MarketPrice(String ticker, BigDecimal price, Instant timestamp) {}

// ═══════════════════════════════════════════════════
// 2. SSE CONTROLLER
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
@Slf4j
public class MarketDataSseController {

    private final MarketDataStreamService streamService;

    /**
     * Endpoint returning standard text/event-stream.
     * WebFlux handles keeping the HTTP connection open and chunking the response.
     */
    @GetMapping(value = "/prices/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<MarketPrice>> streamPrices(
            @RequestParam(required = false) List<String> tickers) {
            
        log.info("New SSE client connected for tickers: {}", tickers);

        return streamService.getPriceStream()
            // 1. Filter by requested tickers (if specified)
            .filter(price -> tickers == null || tickers.contains(price.ticker()))
            
            // 2. Wrap the payload in a ServerSentEvent object (adds 'id', 'event', 'data' fields)
            .map(price -> ServerSentEvent.<MarketPrice>builder()
                .id(UUID.randomUUID().toString()) // Helps client track last event ID for reconnects
                .event("PRICE_UPDATE")            // Custom event type client can listen for
                .data(price)                      // Automatically serialized to JSON
                .build())
                
            // 3. Heartbeat (Keep-Alive): Send empty comment every 15s to prevent proxy timeouts
            .mergeWith(Flux.interval(Duration.ofSeconds(15))
                .map(i -> ServerSentEvent.<MarketPrice>builder()
                    .comment("keep-alive")
                    .build()))
                    
            // 4. Handle client disconnects gracefully
            .doOnCancel(() -> log.info("SSE client disconnected"));
    }
}

// ═══════════════════════════════════════════════════
// 3. ALTERNATIVE: WebMVC SseEmitter (Java 21 Virtual Threads)
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/mvc")
public class MvcSseController {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    // If using spring.threads.virtual.enabled=true, this doesn't block an OS thread
    @GetMapping("/stream")
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(60_000L); // 60s timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        return emitter;
    }

    // Called elsewhere to push data
    public void pushData(Object data) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name("UPDATE")
                    .data(data));
            } catch (IOException e) {
                emitters.remove(emitter); // Client disconnected
            }
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Curl supports SSE natively. It will keep the connection open and print data as it arrives.
curl -N -H "Accept: text/event-stream" "http://localhost:8080/api/v1/market/prices/stream?tickers=AAPL,GOOGL"

# You should see output like:
# id: 550e8400-e29b-41d4-a716-446655440000
# event: PRICE_UPDATE
# data: {"ticker":"AAPL","price":150.25,"timestamp":"2023-10-01T12:00:00Z"}
#
# : keep-alive
```

**Client-Side JavaScript implementation:**
```javascript
const eventSource = new EventSource('/api/v1/market/prices/stream?tickers=AAPL');

// Listen for specific event type
eventSource.addEventListener('PRICE_UPDATE', (event) => {
    const priceData = JSON.parse(event.data);
    console.log('New price:', priceData.ticker, priceData.price);
});

// Auto-reconnect is handled natively by the browser!
eventSource.onerror = (err) => {
    console.error('SSE Error:', err);
};
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always implement a Keep-Alive heartbeat**. AWS ALBs, NGINX, and corporate firewalls will silently drop idle HTTP connections after 30-60 seconds. Sending a `comment` frame (`: keep-alive`) keeps the connection active without triggering JavaScript listeners.
2. **Use `Sinks.Many` with `directBestEffort()`**. If a client's TCP buffer fills up (slow network), `directBestEffort` will drop messages for that specific client rather than buffering them in JVM memory and causing an OutOfMemoryError.
3. **Prefer SSE over WebSockets for one-way data**. SSE is immensely simpler to scale, debug, and route than WebSockets.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `WebFlux` solely for SSE while the rest of the app is MVC | Mixing reactive and blocking code is dangerous. | In a purely MVC app, use Java 21 Virtual Threads + `SseEmitter` instead of pulling in `WebFlux`. |
| Buffering un-consumed messages | Slow clients cause JVM memory exhaustion (OOM). | Drop messages on backpressure (`directBestEffort`). |
| Missing `produces = MediaType.TEXT_EVENT_STREAM_VALUE` | Spring will try to buffer the entire `Flux` into a JSON array and wait for it to finish. | Explicitly define the content type. |
