package com.app.common.client;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * WebClientConfig — Configures a production-grade WebClient for service-to-service HTTP calls.
 *
 * Features:
 * - 5s connect timeout, 30s read/write timeout
 * - Request/Response logging filter (debug level)
 * - Gzip compression support
 * - Codecs configured for large response bodies (50MB limit)
 *
 * Usage:
 *   @Autowired WebClient.Builder webClientBuilder;
 *   WebClient client = webClientBuilder.baseUrl("https://payment-gateway.com").build();
 */
@Configuration
@Slf4j
public class WebClientConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        HttpClient httpClient = HttpClient.create()
            .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)
            .responseTimeout(Duration.ofSeconds(30))
            .compress(true);

        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(50 * 1024 * 1024))
            .filter(logRequest())
            .filter(logResponse());
    }

    private ExchangeFilterFunction logRequest() {
        return ExchangeFilterFunction.ofRequestProcessor(req -> {
            if (log.isDebugEnabled()) {
                log.debug("WebClient → {} {}", req.method(), req.url());
            }
            return Mono.just(req);
        });
    }

    private ExchangeFilterFunction logResponse() {
        return ExchangeFilterFunction.ofResponseProcessor(res -> {
            if (log.isDebugEnabled()) {
                log.debug("WebClient ← {}", res.statusCode());
            }
            return Mono.just(res);
        });
    }
}
