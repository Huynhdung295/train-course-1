package com.app.common.security.fido2;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.time.Duration;
import java.util.Set;

@Configuration
@ConfigurationProperties(prefix = "app.webauthn")
@Validated
@Data
public class WebAuthnProperties {
    @NotBlank private String rpId;
    @NotBlank private String rpName;
    @NotEmpty private Set<String> origins;
    private Duration challengeTtl = Duration.ofMinutes(5);
}
