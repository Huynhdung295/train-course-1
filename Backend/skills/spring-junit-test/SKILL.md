---
name: spring-junit-test
description: Generates a JUnit 5 Unit Test using Mockito and AssertJ following BDD (Given-When-Then) conventions.
---

# Spring Boot JUnit 5 Test Generator Skill

When asked to write unit tests for a Spring Component/Service in this workspace, you MUST adhere to the following architectural standards:

## 1. Core Rules
- **No Spring Context**: Do NOT use `@SpringBootTest` for unit tests. Use `@ExtendWith(MockitoExtension.class)`.
- **BDD Syntax**: Use BDDMockito (`given()`, `willReturn()`) instead of traditional Mockito (`when()`, `thenReturn()`).
- **AssertJ**: Use AssertJ for assertions (`assertThat()`). Do not use standard JUnit assertions (`assertEquals()`).
- **Structure**: Group tests logically using `@Nested` if there are multiple branches for a single method, and label sections with `// GIVEN`, `// WHEN`, `// THEN`.
- **Argument Captors**: Use `@Captor` to deeply verify the state of objects passed to mocked methods.

## 2. Standard Unit Test Template

```java
package com.company.feature.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ResourceServiceTest {

    @Mock
    private ResourceRepository repository;
    
    @Mock
    private ExternalClient externalClient;

    @InjectMocks
    private ResourceService service;

    @Captor
    private ArgumentCaptor<Resource> resourceCaptor;

    @Test
    @DisplayName("Should successfully create a resource when request is valid")
    void createResource_Success() {
        // GIVEN
        var request = new CreateResourceRequest("Test Name");
        var savedResource = new Resource("Test Name");
        
        given(externalClient.validateName(any())).willReturn(true);
        given(repository.save(any(Resource.class))).willReturn(savedResource);

        // WHEN
        ResourceResponse result = service.createResource(request);

        // THEN
        assertThat(result).isNotNull();
        assertThat(result.name()).isEqualTo("Test Name");
        
        verify(repository).save(resourceCaptor.capture());
        Resource captured = resourceCaptor.getValue();
        assertThat(captured.getName()).isEqualTo("Test Name");
    }

    @Test
    @DisplayName("Should throw exception when external validation fails")
    void createResource_ValidationFails() {
        // GIVEN
        var request = new CreateResourceRequest("Bad Name");
        given(externalClient.validateName(any())).willReturn(false);

        // WHEN / THEN
        assertThatThrownBy(() -> service.createResource(request))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid name");
            
        verifyNoInteractions(repository);
    }
}
```
