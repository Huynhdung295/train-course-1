package com.app.common.tracing;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * TraceIdMDCFilter — Propagates trace ID from Micrometer/OTel into MDC for structured logging.
 *
 * This ensures every log statement includes "traceId" and "spanId" fields,
 * enabling correlation between logs and distributed traces in Zipkin/Jaeger.
 */
@Component
@Order(1)
@Slf4j
@RequiredArgsConstructor
@SuppressWarnings("all")
public class TraceIdMDCFilter extends OncePerRequestFilter {

    private final Tracer tracer;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain)
            throws java.io.IOException, jakarta.servlet.ServletException {

        Span currentSpan = tracer.currentSpan();

        if (currentSpan != null) {
            String traceId = currentSpan.context().traceId();
            String spanId = currentSpan.context().spanId();

            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);

            // Also add to response headers for client-side correlation
            response.setHeader("X-Trace-Id", traceId);
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("traceId");
            MDC.remove("spanId");
        }
    }
}
