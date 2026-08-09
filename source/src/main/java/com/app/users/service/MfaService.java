package com.app.users.service;

import org.springframework.stereotype.Service;

@Service
public class MfaService {
    
    public String generateQrCodeUri(String username, String secretKey) {
        // Mock generation of TOTP QR Code URI (e.g., using Google Authenticator format)
        return "otpauth://totp/MyApp:" + username + "?secret=" + secretKey + "&issuer=MyApp";
    }

    public boolean verifyTotp(String secretKey, String code) {
        // Mock TOTP verification logic
        return "123456".equals(code);
    }
}
