package com.app.common.security.fido2.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "passkey_credentials")
@Data
public class PasskeyCredential {
    @Id
    private String credentialId;
    private UUID userId;
    private byte[] credentialIdBytes;
    private byte[] publicKeyCoseBytes;
    private long signatureCount;
    private String aaguid;
    private boolean userVerified;
    private String deviceDisplayName;
    private Instant createdAt;
}
