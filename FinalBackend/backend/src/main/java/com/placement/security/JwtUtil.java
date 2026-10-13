package com.placement.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long accessTokenExpiryMs;
    private final long refreshTokenExpiryMs;
    private final String issuer;
    private final String audience;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiry-ms}") long accessTokenExpiryMs,
            @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.audience}") String audience) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.accessTokenExpiryMs = accessTokenExpiryMs;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateAccessToken(String email, Map<String, Object> claims) {
        return buildToken(email, claims, accessTokenExpiryMs);
    }

    public String generateRefreshToken(String email) {
        return buildToken(email, Map.of("type", "refresh"), refreshTokenExpiryMs);
    }

    private String buildToken(String subject, Map<String, Object> claims, long expiryMs) {
        Date now = new Date();
        Map<String, Object> enrichedClaims = new HashMap<>(claims);
        enrichedClaims.put("iss", issuer);
        enrichedClaims.put("aud", audience);
        return Jwts.builder()
                .claims(enrichedClaims)
                .subject(subject)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryMs))
                .signWith(key)
                .compact();
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = extractAllClaims(token);
        return resolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public boolean isTokenValid(String token, String expectedEmail) {
        try {
            String email = extractEmail(token);
            Date expiration = extractClaim(token, Claims::getExpiration);
            boolean baseValid = safeEquals(email, expectedEmail) && expiration.after(new Date());
            if (!baseValid) {
                return false;
            }
            Claims claims = extractAllClaims(token);
            String tokenIssuer = claims.getIssuer();
            Object tokenAudience = claims.getAudience();
            boolean issuerValid = safeEquals(tokenIssuer, issuer);
            if (!issuerValid) {
                log.warn("JWT issuer mismatch: expected={}, actual={}", issuer, tokenIssuer);
                return false;
            }
            boolean audMatch = isAudienceMatch(tokenAudience, audience);
            if (!audMatch) {
                log.warn("JWT audience mismatch: expected={}, actual={}", audience, tokenAudience);
                return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isAudienceMatch(Object tokenAudience, String expectedAudience) {
        if (tokenAudience == null || expectedAudience == null) {
            return false;
        }
        if (tokenAudience instanceof String audStr) {
            return safeEquals(audStr, expectedAudience);
        }
        Collection<?> audCollection;
        if (tokenAudience instanceof Collection<?> col) {
            audCollection = col;
        } else if (tokenAudience instanceof Object[] arr) {
            audCollection = Arrays.asList(arr);
        } else {
            return safeEquals(tokenAudience.toString(), expectedAudience);
        }
        for (Object a : audCollection) {
            if (a == null) continue;
            if (safeEquals(a.toString(), expectedAudience)) {
                return true;
            }
        }
        return false;
    }

    private static boolean safeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return a.trim().equals(b.trim());
    }

    public boolean isTokenParseable(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Refresh tokens carry {"type": "refresh"}; access tokens carry no "type" claim at all. This
     * was being SET on generation but never CHECKED anywhere - JwtAuthFilter accepted a refresh
     * token as a bearer token for any API call (giving it 7 days of API access instead of the
     * intended 1 hour), and AuthService.refresh() accepted an access token to mint fresh token
     * pairs indefinitely (turning a short-lived access-token leak into an unbounded one). Call
     * this wherever that distinction actually needs to be enforced.
     */
    public boolean isRefreshToken(String token) {
        try {
            return "refresh".equals(extractClaim(token, claims -> claims.get("type", String.class)));
        } catch (Exception e) {
            return false;
        }
    }
}
