package com.app.common.aop;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * AuditAspect — AOP Aspect that intercepts @Auditable methods and records audit logs.
 *
 * In production: persist audit records to audit_log table or dedicated audit service.
 */
@Aspect
@Component
@Slf4j
@SuppressWarnings("all")
public class AuditAspect {

    private final ExpressionParser spelParser = new SpelExpressionParser();

    @AfterReturning(
        pointcut = "@annotation(com.app.common.aop.Auditable)",
        returning = "result"
    )
    public void recordAudit(JoinPoint joinPoint, Object result) {
        recordAuditEntry(joinPoint, "SUCCESS", null);
    }

    @AfterThrowing(
        pointcut = "@annotation(com.app.common.aop.Auditable)",
        throwing = "ex"
    )
    public void recordAuditFailure(JoinPoint joinPoint, Exception ex) {
        recordAuditEntry(joinPoint, "FAILURE", ex.getMessage());
    }

    private void recordAuditEntry(JoinPoint joinPoint, String outcome, String errorMessage) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Auditable annotation = signature.getMethod().getAnnotation(Auditable.class);

        String principal = resolvePrincipal();
        String resourceId = resolveResourceId(annotation, signature, joinPoint.getArgs());

        // NOTE: In production, persist to audit_log table
        log.info("[AUDIT] action={} resourceType={} resourceId={} principal={} outcome={} timestamp={} error={}",
            annotation.action(),
            annotation.resourceType(),
            resourceId,
            principal,
            outcome,
            Instant.now(),
            errorMessage != null ? errorMessage : ""
        );
    }

    private String resolvePrincipal() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null ? auth.getName() : "anonymous";
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String resolveResourceId(Auditable annotation, MethodSignature signature, Object[] args) {
        if (annotation.resourceIdExpression().isBlank()) return "";
        try {
            StandardEvaluationContext ctx = new StandardEvaluationContext();
            String[] paramNames = signature.getParameterNames();
            if (paramNames != null) {
                for (int i = 0; i < paramNames.length; i++) ctx.setVariable(paramNames[i], args[i]);
            }
            return spelParser.parseExpression(annotation.resourceIdExpression()).getValue(ctx, String.class);
        } catch (Exception e) {
            return "unresolved";
        }
    }
}
