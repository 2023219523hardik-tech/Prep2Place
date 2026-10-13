package com.placement.codinglab.config;

import com.placement.codinglab.service.CodingLabService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CodingLabMaintenanceScheduler {

    private final CodingLabService codingLabService;

    @Scheduled(fixedDelay = 5 * 60 * 1000)
    public void expireStaleAttempts() {
        int expired = codingLabService.expireStaleAttempts();
        if (expired > 0) {
            log.info("Expired {} stale coding attempt(s)", expired);
        }
    }
}
