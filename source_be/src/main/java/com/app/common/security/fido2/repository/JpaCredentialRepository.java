package com.app.common.security.fido2.repository;

import com.app.users.repository.UserRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.PublicKeyCredentialType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@SuppressWarnings("all")
public class JpaCredentialRepository implements CredentialRepository {

    private final PasskeyCredentialJpaRepository jpaRepo;
    private final UserRepository userRepo;

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return jpaRepo.findByUserEmail(username).stream()
            .map(cred -> (PublicKeyCredentialDescriptor) PublicKeyCredentialDescriptor.builder()
                .id(new ByteArray(cred.getCredentialIdBytes()))
                .type(PublicKeyCredentialType.PUBLIC_KEY)
                .build())
            .collect(Collectors.toSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return userRepo.findByEmail(username)
            .map(user -> new ByteArray(user.getId().toString().getBytes(StandardCharsets.UTF_8)));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        var userId = new String(userHandle.getBytes(), StandardCharsets.UTF_8);
        return userRepo.findById(UUID.fromString(userId)).map(user -> user.getEmail());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return jpaRepo.findByCredentialId(credentialId.getBase64Url())
            .map(cred -> (RegisteredCredential) RegisteredCredential.builder()
                .credentialId(new ByteArray(cred.getCredentialIdBytes()))
                .userHandle(userHandle)
                .publicKeyCose(new ByteArray(cred.getPublicKeyCoseBytes()))
                .signatureCount(cred.getSignatureCount())
                .build());
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return jpaRepo.findByCredentialId(credentialId.getBase64Url())
            .map(cred -> (Set<RegisteredCredential>) Set.of(
                RegisteredCredential.builder()
                    .credentialId(new ByteArray(cred.getCredentialIdBytes()))
                    .userHandle(new ByteArray(cred.getUserId().toString().getBytes(StandardCharsets.UTF_8)))
                    .publicKeyCose(new ByteArray(cred.getPublicKeyCoseBytes()))
                    .signatureCount(cred.getSignatureCount())
                    .build()
            ))
            .orElse(Set.of());
    }
}
