package com.app.common.security.fido2;

import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.data.AttestationConveyancePreference;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class WebAuthnConfig {

    private final WebAuthnProperties props;

    @Bean
    public RelyingPartyIdentity relyingPartyIdentity() {
        return RelyingPartyIdentity.builder()
            .id(props.getRpId())
            .name(props.getRpName())
            .build();
    }

    @Bean
    public RelyingParty relyingParty(
            RelyingPartyIdentity rpIdentity,
            CredentialRepository credentialRepository) {

        return RelyingParty.builder()
            .identity(rpIdentity)
            .credentialRepository(credentialRepository)
            .origins(props.getOrigins())
            .attestationConveyancePreference(AttestationConveyancePreference.NONE)
            .allowUntrustedAttestation(true)
            .validateSignatureCounter(true)
            .build();
    }
}
