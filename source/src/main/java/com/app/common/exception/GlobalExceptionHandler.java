package com.app.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * GlobalExceptionHandler — RFC 7807 Problem Details for HTTP APIs.
 * 
 * All error responses follow ProblemDetail format:
 * {
 *   "type": "https://api.example.com/errors/validation-failed",
 *   "title": "Validation Failed",
 *   "status": 400,
 *   "detail": "Request body contains invalid fields",
 *   "instance": "/api/v1/orders",
 *   "timestamp": "2024-01-01T00:00:00Z",
 *   "errors": { "field": "error message" }
 * }
 */
@RestControllerAdvice
@Slf4j
@SuppressWarnings("all")
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final String BASE_TYPE = "https://api.ecommerce.com/errors/";

    // ─── Validation Errors ─────────────────────────────────────────────────────

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {

        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                f -> f.getDefaultMessage() != null ? f.getDefaultMessage() : "Invalid value",
                (existing, replacement) -> existing  // Keep first error per field
            ));

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            "Request body contains invalid fields. Please check the errors map."
        );
        problem.setType(URI.create(BASE_TYPE + "validation-failed"));
        problem.setTitle("Validation Failed");
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("errors", fieldErrors);

        log.warn("Validation failed: {}", fieldErrors);
        return ResponseEntity.badRequest().body(problem);
    }

    // ─── Business Logic Exceptions ────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> handleIllegalArgument(
            IllegalArgumentException ex, WebRequest request) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setType(URI.create(BASE_TYPE + "bad-request"));
        problem.setTitle("Invalid Request Parameters");
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("path", request.getDescription(false).replace("uri=", ""));
        log.warn("Invalid argument: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ProblemDetail> handleIllegalState(
            IllegalStateException ex, WebRequest request) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setType(URI.create(BASE_TYPE + "business-rule-violation"));
        problem.setTitle("Business Rule Violation");
        problem.setProperty("timestamp", Instant.now());
        log.warn("Business rule violation: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemDetail> handleResponseStatus(ResponseStatusException ex) {
        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.resolve(ex.getStatusCode().value()),
            ex.getReason() != null ? ex.getReason() : ex.getMessage()
        );
        problem.setType(URI.create(BASE_TYPE + ex.getStatusCode().value()));
        problem.setTitle(ex.getStatusCode().toString());
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(ex.getStatusCode()).body(problem);
    }

    // ─── Catch-all ────────────────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGenericException(
            Exception ex, WebRequest request) {
        log.error("Unhandled exception: path={}", request.getDescription(false), ex);
        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please contact support if the issue persists."
        );
        problem.setType(URI.create(BASE_TYPE + "internal-error"));
        problem.setTitle("Internal Server Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.internalServerError().body(problem);
    }
}
