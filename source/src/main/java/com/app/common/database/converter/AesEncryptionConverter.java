package com.app.common.database.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Converter
@Component
@RequiredArgsConstructor
public class AesEncryptionConverter implements AttributeConverter<String, String> {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;

    @Value("${app.encryption.key:01234567890123456789012345678901}")
    private String encryptionKey;

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        try {
            var key = new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
            var cipher = Cipher.getInstance(ALGORITHM);

            var iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv));

            var encrypted = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            var combined = new byte[GCM_IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, GCM_IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, GCM_IV_LENGTH, encrypted.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Failed to encrypt field", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            var combined = Base64.getDecoder().decode(dbData);
            var iv = Arrays.copyOfRange(combined, 0, GCM_IV_LENGTH);
            var cipherText = Arrays.copyOfRange(combined, GCM_IV_LENGTH, combined.length);

            var key = new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
            var cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv));

            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Failed to decrypt field", e);
        }
    }
}
