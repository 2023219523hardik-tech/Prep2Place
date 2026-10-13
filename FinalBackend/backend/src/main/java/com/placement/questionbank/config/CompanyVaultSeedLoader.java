package com.placement.questionbank.config;

import com.placement.questionbank.service.CompanyVaultSeedService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Runs the CompanyVault rank/frequency import once per startup. Order(16) - after
 * {@code com.placement.config.DataLoader} (Order 10, which calls
 * {@code questionSyncService.syncAll()} and is what actually populates the CanonicalQuestion rows
 * this importer needs to match against) and around
 * {@code InternalCodingProblemSyncLoader} (Order 15); there's no ordering requirement relative to
 * that one specifically, just relative to DataLoader.
 *
 * Safe to run on every startup: {@link CompanyVaultSeedService#importAll()} upserts by unique
 * natural keys (company slug; (company, question) pair), so re-running with the same source files
 * is a no-op after the first run - see {@code CompanyVaultSeedServiceTest} for the idempotency
 * assertion.
 */
@Slf4j
@Component
@Order(16)
@RequiredArgsConstructor
public class CompanyVaultSeedLoader implements CommandLineRunner {

    private final CompanyVaultSeedService companyVaultSeedService;

    @Override
    public void run(String... args) {
        try {
            companyVaultSeedService.importAll();
        } catch (Exception e) {
            // Mirrors DataLoader's own catch-and-log: a bad CompanyVault seed file should never
            // prevent the rest of the application from starting.
            log.error("CompanyVault seed import failed: {}", e.getMessage(), e);
        }
    }
}
