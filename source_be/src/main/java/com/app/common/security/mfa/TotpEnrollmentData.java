package com.app.common.security.mfa;

import java.util.List;

public record TotpEnrollmentData(
    String secret, 
    String otpauthUri, 
    String qrCodeBase64, 
    List<String> backupCodes
) {}
