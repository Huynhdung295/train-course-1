package com.app.common.security.oauth2;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class ClientRegistrationInitializer implements ApplicationRunner {

    private final RegisteredClientRepository clientRepository;

    @Override
    public void run(ApplicationArguments args) {
        registerIfAbsent(RegisteredClient.withId(UUID.randomUUID().toString())
            .clientId("spa-frontend")
            .clientName("Company Web App")
            .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
            .redirectUri("https://app.company.com/callback")
            .redirectUri("http://localhost:3000/callback")
            .postLogoutRedirectUri("https://app.company.com")
            .scope(OidcScopes.OPENID)
            .scope(OidcScopes.PROFILE)
            .scope(OidcScopes.EMAIL)
            .scope("orders:read")
            .scope("orders:write")
            .clientSettings(ClientSettings.builder()
                .requireProofKey(true)                   
                .requireAuthorizationConsent(false)
                .build())
            .tokenSettings(TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofMinutes(15))
                .refreshTokenTimeToLive(Duration.ofDays(7))
                .reuseRefreshTokens(false)               
                .build())
            .build());

        registerIfAbsent(RegisteredClient.withId(UUID.randomUUID().toString())
            .clientId("batch-service")
            .clientSecret("{noop}secret" ) // Mock secret
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
            .scope("orders:admin")
            .scope("inventory:read")
            .tokenSettings(TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofHours(1))
                .build())
            .build());
    }

    private void registerIfAbsent(RegisteredClient client) {
        if (clientRepository.findByClientId(client.getClientId()) == null) {
            clientRepository.save(client);
        }
    }
}
