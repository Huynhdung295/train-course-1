package com.app.common.security.fido2;

import com.app.common.security.fido2.entity.PasskeyCredential;
import com.app.common.security.fido2.repository.PasskeyCredentialJpaRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yubico.webauthn.*;
import com.yubico.webauthn.data.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class WebAuthnService {

    private final RelyingParty relyingParty;
    private final PasskeyCredentialJpaRepository credentialRepo;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public PublicKeyCredentialCreationOptions startRegistration(UUID userId, String username) {
        var userHandle = new ByteArray(userId.toString().getBytes(StandardCharsets.UTF_8));

        var options = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                    .name(username)
                    .displayName(username)
                    .id(userHandle)
                    .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                    .residentKey(ResidentKeyRequirement.REQUIRED)
                    .userVerification(UserVerificationRequirement.REQUIRED)
                    .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                    .build())
                .timeout(5 * 60 * 1000)
                .build()
        );

        var challengeKey = "webauthn:reg:" + userId;
        try {
            var json = objectMapper.writeValueAsString(options);
            redisTemplate.opsForValue().set(challengeKey, json, Duration.ofMinutes(5));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Serialization error", e);
        }

        return options;
    }

    @Transactional
    public boolean finishRegistration(UUID userId, String username, String credentialJson) {
        var challengeKey = "webauthn:reg:" + userId;
        var storedJson = redisTemplate.opsForValue().get(challengeKey);

        if (storedJson == null) {
            throw new RuntimeException("Registration challenge expired");
        }

        try {
            var request = objectMapper.readValue(storedJson, PublicKeyCredentialCreationOptions.class);
            var credential = PublicKeyCredential.parseRegistrationResponseJson(credentialJson);

            var result = relyingParty.finishRegistration(
                FinishRegistrationOptions.builder()
                    .request(request)
                    .response(credential)
                    .build()
            );

            var entity = new PasskeyCredential();
            entity.setCredentialId(result.getKeyId().getId().getBase64Url());
            entity.setUserId(userId);
            entity.setCredentialIdBytes(result.getKeyId().getId().getBytes());
            entity.setPublicKeyCoseBytes(result.getPublicKeyCose().getBytes());
            entity.setSignatureCount(result.getSignatureCount());
            entity.setAaguid(result.getAaguid().getHex());
            entity.setUserVerified(result.isUserVerified());
            entity.setDeviceDisplayName("Passkey on " + result.getAaguid().getHex());
            entity.setCreatedAt(Instant.now());
            credentialRepo.save(entity);

            redisTemplate.delete(challengeKey);
            log.info("Passkey registered for user {}: credId={}", userId,
                entity.getCredentialId().substring(0, 10) + "...");
            return true;
        } catch (Exception e) {
            log.error("Error finishing registration", e);
            throw new RuntimeException("Registration failed", e);
        }
    }

    public AssertionRequest startAuthentication(String usernameHint) {
        var options = relyingParty.startAssertion(
            StartAssertionOptions.builder()
                .username(Optional.ofNullable(usernameHint))
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build()
        );

        var challengeKey = "webauthn:auth:" + options.getPublicKeyCredentialRequestOptions()
            .getChallenge().getBase64Url();
        
        try {
            var json = objectMapper.writeValueAsString(options);
            redisTemplate.opsForValue().set(challengeKey, json, Duration.ofMinutes(5));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Serialization error", e);
        }

        return options;
    }

    @Transactional
    public String finishAuthentication(String credentialJson) {
        try {
            var credential = PublicKeyCredential.parseAssertionResponseJson(credentialJson);
            var challenge = credential.getResponse().getClientData().getChallenge();
            var challengeKey = "webauthn:auth:" + challenge.getBase64Url();
            var storedJson = redisTemplate.opsForValue().get(challengeKey);

            if (storedJson == null) {
                throw new RuntimeException("Authentication challenge expired");
            }

            var request = objectMapper.readValue(storedJson, AssertionRequest.class);
            var result = relyingParty.finishAssertion(
                FinishAssertionOptions.builder()
                    .request(request)
                    .response(credential)
                    .build()
            );

            if (!result.isSuccess()) {
                throw new RuntimeException("WebAuthn assertion failed");
            }

            credentialRepo.updateSignatureCount(
                credential.getId().getBase64Url(),
                result.getSignatureCount()
            );

            redisTemplate.delete(challengeKey);
            log.info("Passkey authentication successful for {}", result.getUsername());
            return result.getUsername();
        } catch (Exception e) {
            log.error("Error finishing authentication", e);
            throw new RuntimeException("Authentication failed", e);
        }
    }
}
