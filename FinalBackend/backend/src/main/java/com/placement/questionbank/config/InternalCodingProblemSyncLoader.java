package com.placement.questionbank.config;

import com.placement.entity.CodingProblem;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import com.placement.questionbank.service.QuestionSimilarity;
import com.placement.repository.CodingProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Registers every already-curated, admin-authored CodingProblem as a canonical question with
 * source=INTERNAL, integrationMode=MANUAL_CURATION. This is what actually makes the Coding Mock
 * Test engine usable end-to-end today: these 66 problems have real statements and test data an
 * admin wrote, unlike the TUF/LeetCode/HackerRank/GFG adapters which currently only carry
 * permitted metadata (see questionbank-seed/README.md). External sources still contribute topic/
 * company/dedup metadata once verified; internal content is what's actually gradable right now.
 *
 * Runs once, after CodingProblem rows exist (DataLoader) - only processes problems that don't
 * already have a canonicalQuestionId, so it's safe to run on every startup.
 */
@Slf4j
@Component
@Order(15)
@RequiredArgsConstructor
public class InternalCodingProblemSyncLoader implements CommandLineRunner {

    private final CodingProblemRepository codingProblemRepository;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final QuestionSourceMappingRepository sourceMappingRepository;

    @Override
    public void run(String... args) {
        List<CodingProblem> unlinked = codingProblemRepository.findByCanonicalQuestionIdIsNull();
        if (unlinked.isEmpty()) return;

        int linked = 0;
        for (CodingProblem problem : unlinked) {
            try {
                var existingOpt = sourceMappingRepository.findBySourceAndSourceQuestionId(QuestionSource.INTERNAL, String.valueOf(problem.getId()));
                if (existingOpt.isPresent() && existingOpt.get().getCanonicalQuestion() != null) {
                    problem.setCanonicalQuestionId(existingOpt.get().getCanonicalQuestion().getId());
                    codingProblemRepository.save(problem);
                    linked++;
                    continue;
                }

                CanonicalQuestion canonical = CanonicalQuestion.builder()
                        .canonicalTitle(problem.getTitle())
                        .normalizedTitleKey(QuestionSimilarity.normalizedKey(problem.getTitle()))
                        .domain(QuestionDomain.CODING)
                        .description(problem.getStatement())
                        .difficulty(problem.getDifficulty())
                        .topics(splitCsv(problem.getTopic()))
                        .companies(splitCsv(problem.getCompanyTags()))
                        .tags(splitCsv(problem.getTopic()))
                        .supportedLanguages(new ArrayList<>(problem.getTemplates() != null ? problem.getTemplates().keySet() : List.of("java", "python", "cpp", "javascript")))
                        .examples(buildExampleStrings(problem))
                        .active(true)
                        .availabilityState(QuestionAvailabilityState.AVAILABLE) // internal content is admin-curated, safe to use immediately
                        .lastSyncedAt(Instant.now())
                        .build();
                canonical = canonicalQuestionRepository.save(canonical);

                sourceMappingRepository.save(QuestionSourceMapping.builder()
                        .canonicalQuestion(canonical)
                        .source(QuestionSource.INTERNAL)
                        .sourceQuestionId(String.valueOf(problem.getId()))
                        .sourceTitle(problem.getTitle())
                        .sourceUrl("/coding/" + problem.getId())
                        .integrationMode(SourceIntegrationMode.MANUAL_CURATION)
                        .attribution("Authored directly in Prep2Place.")
                        .lastSyncedAt(Instant.now())
                        .lastSeenAvailableAt(Instant.now())
                        .sourceAvailable(true)
                        .build());

                problem.setCanonicalQuestionId(canonical.getId());
                codingProblemRepository.save(problem);
                linked++;
            } catch (Exception e) {
                log.warn("Skipped linking coding problem {} into canonical bank: {}", problem.getId(), e.getMessage());
            }
        }
        log.info("Linked {} existing coding problems into the canonical question bank (INTERNAL/MANUAL_CURATION).", linked);
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) return new ArrayList<>();
        return new ArrayList<>(Arrays.stream(csv.split("\\s*,\\s*")).filter(s -> !s.isBlank()).toList());
    }

    private List<String> buildExampleStrings(CodingProblem problem) {
        List<String> out = new ArrayList<>();
        if (problem.getSampleInput() != null || problem.getSampleOutput() != null) {
            out.add("Input: " + safe(problem.getSampleInput()) + " -> Output: " + safe(problem.getSampleOutput()));
        }
        return out;
    }

    private String safe(String s) { return s == null ? "" : s; }
}
