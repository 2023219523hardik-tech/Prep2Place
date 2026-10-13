package com.placement.redis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final StringRedisTemplate redisTemplate;
    private final ConcurrentHashMap<String, Long> localExpirations = new ConcurrentHashMap<>();

    @Value("${app.redis.enabled:false}")
    private boolean redisEnabled;

    public boolean tryAcquire(String key, int ttlSeconds) {
        if (redisEnabled) {
            try {
                Boolean result = redisTemplate.opsForValue()
                        .setIfAbsent(key, "1", ttlSeconds, TimeUnit.SECONDS);
                return Boolean.TRUE.equals(result);
            } catch (Exception e) {
                log.debug("Redis rate limit unavailable for key={}, using in-memory fallback: {}", key, e.getMessage());
            }
        }
        return tryAcquireLocal(key, ttlSeconds);
    }

    public boolean isLimited(String key) {
        if (redisEnabled) {
            try {
                return Boolean.TRUE.equals(redisTemplate.hasKey(key));
            } catch (Exception e) {
                log.debug("Redis rate limit check failed for key={}, using in-memory fallback: {}", key, e.getMessage());
            }
        }
        Long expiresAt = localExpirations.get(key);
        if (expiresAt == null) {
            return false;
        }
        if (System.currentTimeMillis() >= expiresAt) {
            localExpirations.remove(key, expiresAt);
            return false;
        }
        return true;
    }

    private boolean tryAcquireLocal(String key, int ttlSeconds) {
        long now = System.currentTimeMillis();
        if (localExpirations.size() > 10_000) {
            localExpirations.entrySet().removeIf(entry -> entry.getValue() <= now);
        }
        long newExpiry = now + TimeUnit.SECONDS.toMillis(Math.max(1, ttlSeconds));
        Long existing = localExpirations.compute(key, (k, oldExpiry) -> {
            if (oldExpiry == null || oldExpiry <= now) {
                return newExpiry;
            }
            return oldExpiry;
        });
        return existing != null && existing == newExpiry;
    }
}
