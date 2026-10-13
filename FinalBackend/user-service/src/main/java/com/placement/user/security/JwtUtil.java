package com.placement.user.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    public Claims parseToken(String token, String secret) {
        SecretKey key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUsername(String token, String secret) {
        return parseToken(token, secret).getSubject();
    }

    public Date extractExpiration(String token, String secret) {
        return parseToken(token, secret).getExpiration();
    }

    public Boolean isTokenExpired(String token, String secret) {
        return extractExpiration(token, secret).before(new Date());
    }

    public Boolean validateToken(String token, String username, String secret) {
        try {
            final String extractedUsername = extractUsername(token, secret);
            return (extractedUsername.equals(username) && !isTokenExpired(token, secret));
        } catch (Exception e) {
            return false;
        }
    }
}
