package com.app.common.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;


/**
 * HttpClientConfig — RestClient (sync) and WebClient (reactive) configuration.
 *
 * Spring 6 / Boot 3.2+:
 * - RestClient: Modern sync replacement for RestTemplate
 * - WebClient: Reactive non-blocking client for high-throughput scenarios
 */
@Configuration
@Slf4j
@SuppressWarnings("all")
public class HttpClientConfig {

    // ─── RestClient (Sync, Spring 6.1+) ──────────────────────────────────────

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder()
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
    }

    /** Payment gateway RestClient with base URL */
    @Bean(name = "paymentRestClient")
    public RestClient paymentRestClient(RestClient.Builder builder) {
        return builder
            .baseUrl("${payment.gateway.url:https://api.payment-gateway.com}")
            .requestInterceptor((request, body, execution) -> {
                log.debug("[RestClient] {} {}", request.getMethod(), request.getURI());
                var response = execution.execute(request, body);
                log.debug("[RestClient] Response: {}", response.getStatusCode());
                return response;
            })
            .build();
    }

    // ─── WebClient (Reactive, non-blocking) ──────────────────────────────────

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
            .filter(requestLogFilter())
            .filter(responseLogFilter());
    }

    @Bean(name = "inventoryWebClient")
    public WebClient inventoryWebClient(WebClient.Builder builder) {
        return builder
            .baseUrl("${inventory.service.url:http://inventory-service}")
            .build();
    }

    // ─── Exchange Filters (logging interceptors) ──────────────────────────────

    private ExchangeFilterFunction requestLogFilter() {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            log.debug("[WebClient] {} {}", request.method(), request.url());
            return Mono.just(request);
        });
    }

    private ExchangeFilterFunction responseLogFilter() {
        return ExchangeFilterFunction.ofResponseProcessor(response -> {
            log.debug("[WebClient] Response: {}", response.statusCode());
            return Mono.just(response);
        });
    }
}
