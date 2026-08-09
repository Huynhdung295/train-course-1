package com.app.common.security.jwt;

import com.app.common.security.SecurityUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class JwtTokenService {

    private final JwtProperties jwtProperties;
    private final StringRedisTemplate redisTemplate;

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String REFRESH_PREFIX   = "jwt:refresh:";

    public TokenPair generateTokenPair(SecurityUser user) {
        var accessJti  = UUID.randomUUID().toString();
        var refreshJti = UUID.randomUUID().toString();
        var now        = Instant.now();

        var accessToken = buildToken(
            user, accessJti, now,
            now.plus(jwtProperties.accessTokenExpiry()),
            jwtProperties.accessTokenSecret(),
            "access"
        );

        var refreshToken = buildToken(
            user, refreshJti, now,
            now.plus(jwtProperties.refreshTokenExpiry()),
            jwtProperties.refreshTokenSecret(),
            "refresh"
        );

        var refreshKey = REFRESH_PREFIX + user.getUserId() + ":" + refreshJti;
        redisTemplate.opsForValue().set(
            refreshKey,
            refreshJti,
            jwtProperties.refreshTokenExpiry()
        );

        return new TokenPair(accessToken, refreshToken, jwtProperties.accessTokenExpiry());
    }

    private String buildToken(SecurityUser user, String jti, Instant iat, Instant exp,
                               String secret, String tokenType) {
        var key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
            .id(jti)
            .subject(user.getUserId().toString())
            .issuer(jwtProperties.issuer())
            .audience().add(jwtProperties.audience()).and()
            .issuedAt(Date.from(iat))
            .expiration(Date.from(exp))
            .claim("email", user.getUsername())
            .claim("roles", user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList())
            .claim("tenantId", user.getTenantId())
            .claim("type", tokenType)
            .signWith(key)
            .compact();
    }

    public Claims validateAccessToken(String token) {
        var claims = parseToken(token, jwtProperties.accessTokenSecret());
        if (!"access".equals(claims.get("type", String.class))) {
            throw new RuntimeException("Not an access token");
        }
        if (isBlacklisted(claims.getId())) {
            throw new RuntimeException("Token has been revoked: " + claims.getId());
        }
        return claims;
    }

    public Claims validateRefreshToken(String token) {
        var claims = parseToken(token, jwtProperties.refreshTokenSecret());
        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new RuntimeException("Not a refresh token");
        }
        return claims;
    }

    private Claims parseToken(String token, String secret) {
        try {
            var key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(jwtProperties.issuer())
                .requireAudience(jwtProperties.audience())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        } catch (ExpiredJwtException e) {
            throw new RuntimeException("Token expired", e);
        } catch (MalformedJwtException | SignatureException e) {
            throw new RuntimeException("Invalid token signature or format", e);
        }
    }

    public TokenPair rotateTokens(String refreshToken, SecurityUser user) {
        var claims = validateRefreshToken(refreshToken);
        var oldJti = claims.getId();

        var remainingTtl = Duration.between(Instant.now(), claims.getExpiration().toInstant());
        blacklistToken(oldJti, remainingTtl);

        var oldKey = REFRESH_PREFIX + user.getUserId() + ":" + oldJti;
        redisTemplate.delete(oldKey);

        log.debug("Rotating tokens for user {}", user.getUserId());
        return generateTokenPair(user);
    }

    public void revokeAllUserTokens(UUID userId) {
        var pattern = REFRESH_PREFIX + userId + ":*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        log.info("Revoked all tokens for user {}", userId);
    }

    public void blacklistToken(String jti, Duration ttl) {
        if (ttl != null && !ttl.isNegative() && !ttl.isZero()) {
            redisTemplate.opsForValue().set(BLACKLIST_PREFIX + jti, "revoked", ttl);
        }
    }

    public boolean isBlacklisted(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
    }
}
