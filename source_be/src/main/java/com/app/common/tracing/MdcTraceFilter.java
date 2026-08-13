package com.app.common.tracing;

import com.app.common.security.SecurityUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * MdcTraceFilter — Enriches every log line with structured context fields.
 *
 * Fields added to MDC (Mapped Diagnostic Context):
 *   - traceId:    Random UUID per request (or taken from X-Trace-Id header for distributed tracing)
 *   - tenantId:   From X-Tenant-ID header (set by Nginx)
 *   - userId:     From authenticated user (if logged in)
 *   - requestId:  Unique per request
 *   - method:     HTTP method (GET, POST, ...)
 *   - path:       Request path
 *
 * These fields appear in every log line produced by logback-spring.xml's LogstashEncoder,
 * making it trivial to filter logs by tenant or trace in Kibana / Grafana Loki.
 */
@Component
@Slf4j
public class MdcTraceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String traceId = resolveTraceId(request);
        String tenantId = request.getHeader("X-Tenant-ID");
        String requestId = UUID.randomUUID().toString().substring(0, 8);

        try {
            MDC.put("traceId", traceId);
            MDC.put("requestId", requestId);
            if (tenantId != null) MDC.put("tenantId", tenantId);
            MDC.put("method", request.getMethod());
            MDC.put("path", request.getRequestURI());

            // Set userId after security context is populated (post-JWT filter)
            populateUserContext();

            // Pass traceId to response for client-side correlation
            response.setHeader("X-Trace-Id", traceId);

            filterChain.doFilter(request, response);
        } finally {
            // Always clear MDC to prevent context leaking between requests
            MDC.clear();
        }
    }

    private String resolveTraceId(HttpServletRequest request) {
        String incoming = request.getHeader("X-Trace-Id");
        return (incoming != null && !incoming.isBlank()) ? incoming : UUID.randomUUID().toString();
    }

    private void populateUserContext() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof SecurityUser) {
                SecurityUser securityUser = (SecurityUser) auth.getPrincipal();
                MDC.put("userId", securityUser.getUserId().toString());
                MDC.put("tenantId", securityUser.getTenantId());
            }
        } catch (Exception ignored) {
            // Security context not yet populated at this point — will be set later
        }
    }
}
