package com.app.common.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@SuppressWarnings("all")
public class PaymentClient {

    private final RestClient restClient;

    public PaymentClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://api.payment-gateway.com").build();
    }

    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public boolean processPayment(String payload) {
        // Mock external call
        return Boolean.TRUE.equals(restClient.post()
                .uri("/v1/charge")
                .body(payload)
                .retrieve()
                .body(Boolean.class));
    }

    public boolean paymentFallback(String payload, Throwable t) {
        // Fallback logic when payment gateway is down
        return false;
    }
}
