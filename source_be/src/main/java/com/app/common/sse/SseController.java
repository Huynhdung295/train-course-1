package com.app.common.sse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * SseController — Server-Sent Events endpoint for real-time notifications.
 *
 * SSE provides one-way server→client streaming (simpler than WebSocket).
 * Uses Spring WebFlux Flux<ServerSentEvent<T>> for reactive streaming.
 *
 * Client usage:
 *   const source = new EventSource('/api/v1/sse/notifications?userId=xyz');
 *   source.addEventListener('order-update', e => console.log(JSON.parse(e.data)));
 */
@RestController
@RequestMapping("/api/v1/sse")
@Slf4j
@RequiredArgsConstructor
@SuppressWarnings("all")
public class SseController {

    // Per-user SSE sinks — each connected client gets its own Sink
    private final Map<String, Sinks.Many<ServerSentEvent<Object>>> userSinks =
        new ConcurrentHashMap<>();

    private final AtomicLong eventCounter = new AtomicLong(0);

    /**
     * SSE subscription endpoint.
     * Client connects here and receives events pushed from server.
     */
    @GetMapping(value = "/notifications", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Object>> streamNotifications(
            @RequestParam String userId) {

        log.info("SSE client connected: userId={}", userId);

        // Create a Multicast sink for this user
        var sink = Sinks.many().multicast().<ServerSentEvent<Object>>onBackpressureBuffer();
        userSinks.put(userId, sink);

        return sink.asFlux()
            // Heartbeat every 15s to keep connection alive (prevents proxy timeout)
            .mergeWith(
                Flux.interval(Duration.ofSeconds(15))
                    .map(i -> ServerSentEvent.<Object>builder()
                        .event("heartbeat")
                        .data("ping")
                        .build())
            )
            .doOnCancel(() -> {
                userSinks.remove(userId);
                log.info("SSE client disconnected: userId={}", userId);
            })
            .doOnError(e -> {
                userSinks.remove(userId);
                log.warn("SSE error for userId={}: {}", userId, e.getMessage());
            });
    }

    /**
     * Push an event to a specific user's SSE stream.
     * Called internally when order status changes, etc.
     */
    public void pushToUser(String userId, String eventType, Object data) {
        var sink = userSinks.get(userId);
        if (sink == null) {
            log.debug("No SSE sink for userId={}, skipping push", userId);
            return;
        }

        var event = ServerSentEvent.<Object>builder()
            .id(String.valueOf(eventCounter.incrementAndGet()))
            .event(eventType)
            .data(data)
            .build();

        sink.tryEmitNext(event);
        log.debug("Pushed SSE event '{}' to userId={}", eventType, userId);
    }

    /**
     * Broadcast an event to ALL connected SSE clients.
     */
    public void broadcast(String eventType, Object data) {
        userSinks.forEach((userId, sink) -> pushToUser(userId, eventType, data));
        log.info("Broadcast SSE event '{}' to {} clients", eventType, userSinks.size());
    }
}
