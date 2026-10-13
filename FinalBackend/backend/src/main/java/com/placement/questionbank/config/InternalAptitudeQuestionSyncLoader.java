package com.placement.questionbank.config;

import com.placement.entity.AptitudeQuestion;
import com.placement.repository.AptitudeQuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Syncs unlinked AptitudeQuestion rows into canonical_question (domain = APTITUDE)
 * and links them with QuestionSourceMapping.
 * Runs on startup with Order(16) so that Aptitude Mock Tests and placement assessments
 * have full access to the curated question bank.
 */
@Slf4j
@Component
@Order(16)
@RequiredArgsConstructor
public class InternalAptitudeQuestionSyncLoader implements CommandLineRunner {

    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final InternalAptitudeQuestionSyncService syncService;

    @Override
    public void run(String... args) {
        List<AptitudeQuestion> unlinked = aptitudeQuestionRepository.findByCanonicalQuestionIdIsNull();
        if (unlinked.isEmpty()) {
            log.info("All aptitude questions are already synced to canonical questions.");
            return;
        }

        log.info("Found {} unlinked aptitude questions to sync into canonical questions...", unlinked.size());
        int count = 0;
        for (AptitudeQuestion q : unlinked) {
            try {
                if (syncService.syncQuestion(q)) {
                    count++;
                }
            } catch (Exception e) {
                log.warn("Failed to sync aptitude question {}: {}", q.getId(), e.getMessage());
            }
        }
        log.info("Successfully synced and linked {} aptitude questions to canonical questions.", count);
    }
}
