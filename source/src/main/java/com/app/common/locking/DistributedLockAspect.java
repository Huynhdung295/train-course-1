package com.app.common.locking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * DistributedLockAspect — AOP Aspect that intercepts @DistributedLock annotated methods
 * and applies Redisson distributed locks automatically.
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class DistributedLockAspect {

    private final RedissonClient redissonClient;
    private final ExpressionParser spelParser = new SpelExpressionParser();

    @Around("@annotation(com.app.common.locking.DistributedLock)")
    public Object applyDistributedLock(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        DistributedLock lockAnnotation = method.getAnnotation(DistributedLock.class);

        String lockKey = buildLockKey(lockAnnotation, signature, joinPoint.getArgs());
        RLock lock = redissonClient.getLock(lockKey);

        log.debug("Attempting to acquire distributed lock: {}", lockKey);

        boolean acquired = false;
        try {
            acquired = lock.tryLock(
                lockAnnotation.waitTime(),
                lockAnnotation.leaseTime(),
                lockAnnotation.timeUnit()
            );

            if (!acquired) {
                throw new DistributedLockException(
                    "Failed to acquire distributed lock for key: " + lockKey);
            }

            log.debug("Acquired distributed lock: {}", lockKey);
            return joinPoint.proceed();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new DistributedLockException("Interrupted while waiting for lock: " + lockKey, e);
        } finally {
            if (acquired && lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("Released distributed lock: {}", lockKey);
            }
        }
    }

    /**
     * Resolves the lock key using SpEL if the key expression references method params.
     */
    private String buildLockKey(DistributedLock annotation, MethodSignature signature, Object[] args) {
        String keyExpression = annotation.key();
        String prefix = annotation.prefix();

        // Resolve SpEL expression
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
            // Fallback to literal key expression
            resolvedKey = keyExpression;
        }

        return prefix + resolvedKey;
    }
}
