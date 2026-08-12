package com.app.common;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
// In real app, configure @Testcontainers here for DB, Redis, Kafka

@SpringBootTest
@ActiveProfiles("test")
public abstract class IntegrationTestBase {
    // Shared testcontainer setup
}
