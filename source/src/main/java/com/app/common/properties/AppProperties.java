package com.app.common.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.config")
@Data
public class AppProperties {
    private String systemName;
    private int maxRetries;
    private FeatureToggle featureToggle = new FeatureToggle();

    @Data
    public static class FeatureToggle {
        private boolean newCheckoutFlow;
        private boolean experimentalUi;
    }
}
