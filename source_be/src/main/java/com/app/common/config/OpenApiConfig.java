package com.app.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenApiConfig — Configures Swagger UI with JWT Bearer Token auth and multi-server support.
 *
 * Access the UI at:  http://localhost:8080/swagger-ui.html
 * Access the spec at: http://localhost:8080/v3/api-docs
 *
 * Usage: Click "Authorize" button → Paste the Bearer token → All API calls will include it.
 */
@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Value("${spring.application.name:Nexus Core API}")
    private String appName;

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title(appName + " — API Documentation")
                .version("1.0.0")
                .description(
                    "**Nexus POS & ERP** — Multi-Tenant Enterprise REST API\n\n" +
                    "## Authentication\n" +
                    "Use the **Authorize** button to set your JWT Bearer token.\n" +
                    "Token format: `Bearer eyJhbGciOiJI...`\n\n" +
                    "## Multi-Tenancy\n" +
                    "Pass the `X-Tenant-ID` header on every request to route to the correct tenant schema."
                )
                .contact(new Contact()
                    .name("Nexus Team")
                    .email("dev@nexus.com"))
                .license(new License()
                    .name("Proprietary")
                    .url("https://nexus.com")))
            .servers(List.of(
                new Server().url("http://localhost:8080").description("Local Development"),
                new Server().url("https://api.nexus.com").description("Production")
            ))
            .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
            .components(new Components()
                .addSecuritySchemes(SECURITY_SCHEME_NAME,
                    new SecurityScheme()
                        .name(SECURITY_SCHEME_NAME)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Enter your JWT token obtained from POST /api/v1/auth/login")));
    }
}
