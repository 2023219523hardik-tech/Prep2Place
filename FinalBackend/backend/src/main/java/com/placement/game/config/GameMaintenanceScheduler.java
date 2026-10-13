package com.placement.game.config;

import com.placement.game.service.GameEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Catches attempts whose timer ran out but whose client never called /complete (tab closed,
 *  connection dropped, etc.) so they don't sit as STARTED forever - Section 15 EXPIRED status. */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameMaintenanceScheduler {

    private final GameEngineService gameEngineService;

    @Scheduled(fixedDelay = 5 * 60 * 1000)
    public void expireStaleAttempts() {
        int expired = gameEngineService.expireStaleAttempts();
        if (expired > 0) {
            log.info("Expired {} stale game attempt(s)", expired);
        }
    }
}
