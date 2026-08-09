package com.app.common.security.mfa;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class SmsOtpService {

    private final StringRedisTemplate redisTemplate;
    private final TwilioSmsProvider smsProvider;

    private static final String OTP_KEY_PREFIX       = "otp:code:";
    private static final String ATTEMPT_KEY_PREFIX   = "otp:attempts:";
    private static final String SEND_RATE_KEY_PREFIX = "otp:send-rate:";
    private static final int OTP_LENGTH              = 6;
    private static final int OTP_TTL_MINUTES         = 5;
    private static final int MAX_VERIFY_ATTEMPTS     = 5;
    private static final int LOCKOUT_MINUTES         = 15;
    private static final int MAX_SENDS_PER_HOUR      = 3;

    public void sendOtp(UUID userId, String phoneNumber, OtpPurpose purpose) {
        var sendRateKey = SEND_RATE_KEY_PREFIX + userId + ":" + purpose;
        var sendCount = redisTemplate.opsForValue().increment(sendRateKey);
        if (sendCount != null && sendCount == 1) {
            redisTemplate.expire(sendRateKey, Duration.ofHours(1));
        }
        if (sendCount != null && sendCount > MAX_SENDS_PER_HOUR) {
            throw new RuntimeException("Maximum OTP requests exceeded.");
        }

        var otp = generateSecureOtp();
        var otpKey = OTP_KEY_PREFIX + userId + ":" + purpose;
        redisTemplate.opsForValue().set(otpKey, otp, Duration.ofMinutes(OTP_TTL_MINUTES));

        smsProvider.sendSms(
            phoneNumber,
            String.format("[Company] Your verification code is: %s. Valid for %d minutes.", otp, OTP_TTL_MINUTES)
        );

        log.info("OTP sent to phone {}*** for user {} purpose {}",
            phoneNumber.length() > 4 ? phoneNumber.substring(0, 4) : "", userId, purpose);
    }

    public boolean verifyOtp(UUID userId, OtpPurpose purpose, String submittedOtp) {
        var attemptsKey = ATTEMPT_KEY_PREFIX + userId + ":" + purpose;
        var attempts = redisTemplate.opsForValue().get(attemptsKey);
        
        if (attempts != null && Long.parseLong(attempts) >= MAX_VERIFY_ATTEMPTS) {
            var ttl = redisTemplate.getExpire(attemptsKey, TimeUnit.SECONDS);
            throw new RuntimeException("Account locked. Try again later.");
        }

        var otpKey = OTP_KEY_PREFIX + userId + ":" + purpose;
        var storedOtp = redisTemplate.opsForValue().get(otpKey);

        if (storedOtp == null) {
            throw new RuntimeException("OTP has expired.");
        }

        if (!MessageDigest.isEqual(
                storedOtp.getBytes(StandardCharsets.UTF_8),
                submittedOtp.getBytes(StandardCharsets.UTF_8))) {

            var newCount = redisTemplate.opsForValue().increment(attemptsKey);
            if (newCount != null && newCount == 1) {
                redisTemplate.expire(attemptsKey, Duration.ofMinutes(LOCKOUT_MINUTES));
            }
            log.warn("Invalid OTP attempt {} for user {}", newCount, userId);
            return false;
        }

        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);
        log.info("OTP verified successfully for user {} purpose {}", userId, purpose);
        return true;
    }

    private String generateSecureOtp() {
        var random = new SecureRandom();
        var digits = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            digits.append(random.nextInt(10));
        }
        return digits.toString();
    }
}
