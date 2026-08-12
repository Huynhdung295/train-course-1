package com.app.common.security.jwt;

import com.app.common.security.SecurityUser;
import com.app.users.service.SecurityUserDetailsService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenService tokenService;
    private final SecurityUserDetailsService userDetailsService;

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(
                request.email(), request.password()
            )
        );

        var user = (SecurityUser) authentication.getPrincipal();
        var tokenPair = tokenService.generateTokenPair(user);

        setRefreshTokenCookie(response, tokenPair.refreshToken());

        return ResponseEntity.ok(new TokenResponse(
            tokenPair.accessToken(),
            tokenPair.expiresIn().getSeconds()
        ));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response) {

        if (refreshToken == null) {
            throw new RuntimeException("Refresh token cookie not found");
        }

        var claims = tokenService.validateRefreshToken(refreshToken);
        var user = (SecurityUser) userDetailsService.loadUserByUsername(
            claims.get("email", String.class)
        );

        var newTokenPair = tokenService.rotateTokens(refreshToken, user);

        setRefreshTokenCookie(response, newTokenPair.refreshToken());

        return ResponseEntity.ok(new TokenResponse(
            newTokenPair.accessToken(),
            newTokenPair.expiresIn().getSeconds()
        ));
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            @AuthenticationPrincipal SecurityUser user,
            HttpServletResponse response) {

        if (refreshToken != null) {
            try {
                tokenService.validateRefreshToken(refreshToken);
                tokenService.revokeAllUserTokens(user.getUserId());
            } catch (Exception e) {
                log.warn("Could not validate refresh token during logout");
            }
        }

        var cookie = new Cookie("refresh_token", null);
        cookie.setMaxAge(0);
        cookie.setPath("/api/v1/auth");
        response.addCookie(cookie);

        return ResponseEntity.noContent().build();
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", refreshToken)
            .httpOnly(true)           
            .secure(true)             
            .sameSite("Strict")       
            .path("/api/v1/auth")     
            .maxAge(Duration.ofDays(7))
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

@SuppressWarnings("all")

record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password
) {}

@SuppressWarnings("all")

record TokenResponse(String accessToken, long expiresIn) {}
