package com.app.common.locking;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.ResponseEntity;

import java.util.ConcurrentModificationException;

/**
 * ConcurrencyExceptionHandler — Handles optimistic and pessimistic lock failures.
 * Returns RFC 7807 ProblemDetail responses for lock conflicts.
 */
@RestControllerAdvice
@Slf4j
public class ConcurrencyExceptionHandler {

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(
            ObjectOptimisticLockingFailureException ex) {
        log.warn("Optimistic lock failure: entity={}, id={}",
            ex.getPersistentClassName(), ex.getIdentifier());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "The resource was modified by another user. Please refresh and try again."
        );
        problem.setTitle("Concurrent Modification");
        problem.setProperty("entityType", ex.getPersistentClassName());
        problem.setProperty("entityId", String.valueOf(ex.getIdentifier()));
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handlePessimisticLock(
            PessimisticLockingFailureException ex) {
        log.warn("Pessimistic lock failure: {}", ex.getMessage());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Resource is temporarily locked by another operation. Please try again in a moment."
        );
        problem.setTitle("Resource Locked");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(ConcurrentModificationException.class)
    public ResponseEntity<ProblemDetail> handleConcurrentModification(
            ConcurrentModificationException ex) {
        log.warn("Concurrent modification: {}", ex.getMessage());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            ex.getMessage()
        );
        problem.setTitle("Concurrent Modification");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
