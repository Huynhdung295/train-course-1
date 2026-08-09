package com.app.common.ratelimit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;

/**
 * RateLimitAspect — AOP aspect that intercepts @RateLimit annotated methods
 * and applies Redis-backed sliding window rate limiting.
 *
 * Algorithm: Increment counter in Redis with TTL = windowSeconds.
 * If count > maxRequests → throw 429 Too Many Requests.
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class RateLimitAspect {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ExpressionParser spelParser = new SpelExpressionParser();

    @Around("@annotation(com.app.common.ratelimit.RateLimit)")
    public Object applyRateLimit(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        RateLimit annotation = signature.getMethod().getAnnotation(RateLimit.class);

        String rateLimitKey = buildKey(annotation, signature, joinPoint.getArgs());

        Long count = redisTemplate.opsForValue().increment(rateLimitKey);

        if (count == 1) {
            // First request in this window — set expiry
            redisTemplate.expire(rateLimitKey, Duration.ofSeconds(annotation.windowSeconds()));
        }

        if (count != null && count > annotation.maxRequests()) {
            log.warn("Rate limit exceeded for key={}, count={}, max={}", 
                rateLimitKey, count, annotation.maxRequests());
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS, annotation.message());
        }

        log.debug("Rate limit check: key={}, count={}/{}", rateLimitKey, count, annotation.maxRequests());
        return joinPoint.proceed();
    }

    private String buildKey(RateLimit annotation, MethodSignature signature, Object[] args) {
        String keyExpression = annotation.keyExpression();

        StandardEvaluationContext context = new StandardEvaluationContext();
        String[] paramNames = signature.getParameterNames();
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);
            }
        }

        String resolvedKey;
        try {
            resolvedKey = spelParser.parseExpression(keyExpression).getValue(context, String.class);
        } catch (Exception e) {
            resolvedKey = keyExpression;
        }

        return "rate:limit:" + signature.getDeclaringTypeName() + ":" +
               signature.getName() + ":" + resolvedKey;
    }
}
