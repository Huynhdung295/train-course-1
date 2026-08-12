package com.app.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.time.Instant;

/**
 * ApiResponse<T> — Standard envelope for ALL successful API responses.
 *
 * Every successful endpoint should wrap its result in this object so the
 * Frontend has a consistent contract to parse.
 *
 * Success example:
 * {
 *   "success": true,
 *   "message": "Order created successfully",
 *   "data": { ... },
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 *
 * Usage:
 *   return ResponseEntity.ok(ApiResponse.success("Order created", orderDto));
 */
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final String message;
    private final T data;
    private final Instant timestamp;

    private ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.timestamp = Instant.now();
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "OK", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> created(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static ApiResponse<Void> noContent(String message) {
        return new ApiResponse<>(true, message, null);
    }
}
