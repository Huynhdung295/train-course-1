package com.app.common.security.mfa;

import com.app.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@SuppressWarnings("all")
public class MfaAuthController {

    private final TotpService totpService;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/mfa-login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        // Mock authentication, in reality uses AuthenticationManager
        UUID userId = UUID.randomUUID(); 
        boolean isTotpEnabled = true; // In reality, user.isTotpEnabled()

        if (isTotpEnabled) {
            var challengeId = UUID.randomUUID().toString();
            redisTemplate.opsForValue().set(
                "mfa:challenge:" + challengeId,
                userId.toString(),
                Duration.ofMinutes(5)
            );

            return ResponseEntity.ok(Map.of(
                "mfaRequired", true,
                "mfaChallengeId", challengeId,
                "mfaMethods", List.of("TOTP")
            ));
        }

        return ResponseEntity.ok(new ApiResponse<>("success", "Token", null));
    }

    @PostMapping("/mfa/totp/verify")
    public ResponseEntity<?> verifyTotp(@Valid @RequestBody TotpVerifyRequest request) {
        var userIdStr = redisTemplate.opsForValue().get("mfa:challenge:" + request.challengeId());

        if (userIdStr == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("MFA challenge expired or invalid");
        }

        var userId = UUID.fromString(userIdStr);
        var valid = totpService.verifyCode(userId, request.code());

        if (!valid) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        redisTemplate.delete("mfa:challenge:" + request.challengeId());
        return ResponseEntity.ok(new ApiResponse<>("success", "MFA Login successful", null));
    }
}

@SuppressWarnings("all")

record TotpVerifyRequest(@NotBlank String challengeId, int code) {}
