package com.app.common.security.auth;

import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@SuppressWarnings("all")
public class AuthStrategyFactory {

    private final Map<String, AuthStrategy> strategies;

    // Spring automatically injects all beans implementing AuthStrategy!
    public AuthStrategyFactory(List<AuthStrategy> strategyList) {
        this.strategies = strategyList.stream()
                .collect(Collectors.toMap(AuthStrategy::getType, Function.identity()));
    }

    public AuthStrategy getStrategy(String type) {
        AuthStrategy strategy = strategies.get(type.toUpperCase());
        if (strategy == null) {
            throw new IllegalArgumentException("Unknown auth type: " + type);
        }
        return strategy;
    }
}
