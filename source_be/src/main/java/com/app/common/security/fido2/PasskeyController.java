package com.app.common.security.fido2;

import com.app.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth/passkey")
@RequiredArgsConstructor
public class PasskeyController {

    private final WebAuthnService webAuthnService;

    // Use hardcoded IDs/Names for mock if we don't have SecurityUser yet in context
    @PostMapping("/register/options")
    public ResponseEntity<String> registrationOptions(@RequestParam String username) {
        // Mock userId for demonstration, real app uses AuthenticationPrincipal
        UUID userId = UUID.randomUUID(); 
        var options = webAuthnService.startRegistration(userId, username);
        try {
            return ResponseEntity.ok(options.toCredentialsCreateJson());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/register/finish")
    public ResponseEntity<Map<String, Boolean>> finishRegistration(
            @RequestParam UUID userId,
            @RequestParam String username,
            @RequestBody String credentialJson) {
        var success = webAuthnService.finishRegistration(userId, username, credentialJson);
        return ResponseEntity.ok(Map.of("success", success));
    }

    @PostMapping("/login/options")
    public ResponseEntity<String> loginOptions(@RequestParam(required = false) String username) {
        var request = webAuthnService.startAuthentication(username);
        try {
            return ResponseEntity.ok(request.toCredentialsGetJson());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/login/finish")
    public ResponseEntity<ApiResponse<String>> finishLogin(@RequestBody String credentialJson) {
        var username = webAuthnService.finishAuthentication(credentialJson);
        return ResponseEntity.ok(ApiResponse.success("Logged in user: " + username, null));
    }
}
