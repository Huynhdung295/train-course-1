package com.app.common.ratelimit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @RateLimit — Custom annotation for endpoint rate limiting via AOP.
 *
 * Usage:
 *   @RateLimit(maxRequests = 100, windowSeconds = 60, keyExpression = "#request.remoteAddr")
 *   public ResponseEntity<?> createOrder(HttpServletRequest request) { ... }
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {

    /** Maximum requests allowed in the time window */
    int maxRequests() default 100;

    /** Time window in seconds */
    int windowSeconds() default 60;

    /**
     * SpEL expression to compute the rate limit key (identifies who is being rate-limited).
     * e.g. "'user:' + #userId", "#request.remoteAddr", "'global'"
     */
    String keyExpression() default "'global'";

    /** Error message returned when rate limit is exceeded */
    String message() default "Rate limit exceeded. Please try again later.";
}
