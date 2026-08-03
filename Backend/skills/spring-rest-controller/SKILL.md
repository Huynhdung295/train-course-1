---
name: spring-rest-controller
description: Generates a Spring Boot REST Controller following production-grade standards (RFC 7807, DTOs, @RestControllerAdvice).
---

# Spring Boot REST Controller Generator Skill

When asked to create or modify a Spring Boot REST Controller in this workspace, you MUST adhere to the following architectural standards:

## 1. Core Rules
- **Never expose raw Entities**: Always use Request/Response DTOs (Java Records).
- **Constructor Injection**: Always use `@RequiredArgsConstructor` (Lombok) instead of `@Autowired`.
- **API Versioning**: Prefix endpoints with `/api/v1/...`.
- **Validation**: Use Jakarta Validation (`@Valid`, `@NotBlank`, etc.) on incoming request DTOs.
- **Error Handling**: Do not write `try-catch` blocks in the controller. Let exceptions bubble up to the global `@RestControllerAdvice` (RFC 7807 ProblemDetail).
- **Responses**: Return `ResponseEntity<T>` for all endpoints to explicitly control HTTP status codes.

## 2. Standard Template Example

```java
package com.company.feature.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/resources")
@RequiredArgsConstructor
@Slf4j
public class ResourceController {

    private final ResourceService resourceService;

    @PostMapping
    public ResponseEntity<ResourceResponse> createResource(@Valid @RequestBody CreateResourceRequest request) {
        log.info("Received request to create resource: {}", request.name());
        ResourceResponse response = resourceService.createResource(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourceResponse> getResource(@PathVariable UUID id) {
        ResourceResponse response = resourceService.getResourceById(id);
        return ResponseEntity.ok(response);
    }
}
```

## 3. DTO Standards
Always generate DTOs as Java Records.

```java
public record CreateResourceRequest(
    @NotBlank(message = "Name is required") String name,
    @Min(value = 0, message = "Value cannot be negative") int value
) {}

public record ResourceResponse(UUID id, String name, int value) {}
```
