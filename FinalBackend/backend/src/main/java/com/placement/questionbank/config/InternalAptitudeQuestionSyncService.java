package com.placement.questionbank.config;

import com.placement.entity.AptitudeQuestion;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.QuestionAvailabilityState;
import com.placement.questionbank.entity.QuestionDomain;
import com.placement.questionbank.entity.QuestionSourceMapping;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.SourceIntegrationMode;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import com.placement.questionbank.service.QuestionSimilarity;
import com.placement.repository.AptitudeQuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InternalAptitudeQuestionSyncService {

    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final QuestionSourceMappingRepository sourceMappingRepository;

    /**
     * Each question gets its own transaction.
     *
     * If one question fails, only that question is rolled back.
     * The next question can continue normally.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean syncQuestion(AptitudeQuestion question) {

        if (question == null || question.getId() == null) {
            log.warn("Skipping invalid aptitude question: null question or id");
            return false;
        }

        if (question.getCanonicalQuestionId() != null) {
            log.debug(
                    "Aptitude question {} is already linked to canonical question {}",
                    question.getId(),
                    question.getCanonicalQuestionId()
            );
            return false;
        }

        String questionText = question.getText();

        if (questionText == null || questionText.isBlank()) {
            log.warn(
                    "Skipping aptitude question {} because question text is empty",
                    question.getId()
            );
            return false;
        }

        String title = questionText.length() > 120
                ? questionText.substring(0, 120) + "..."
                : questionText;

        List<String> topics = new ArrayList<>();

        if (question.getTopic() != null
                && !question.getTopic().isBlank()) {

            topics.add(question.getTopic().trim());
        }

        Instant now = Instant.now();

        /*
         * Create canonical question.
         */
        CanonicalQuestion canonical = CanonicalQuestion.builder()
                .canonicalTitle(title)
                .normalizedTitleKey(
                        QuestionSimilarity.normalizedKey(title)
                )
                .domain(QuestionDomain.APTITUDE)
                .description(questionText)
                .difficulty(question.getDifficulty())
                .topics(new ArrayList<>(topics))
                .tags(new ArrayList<>(topics))
                .subtopics(new ArrayList<>())
                .companies(new ArrayList<>())
                .supportedLanguages(new ArrayList<>())
                .examples(new ArrayList<>())
                .active(true)
                .availabilityState(
                        QuestionAvailabilityState.AVAILABLE
                )
                .lastSyncedAt(now)
                .build();

        canonical = canonicalQuestionRepository.saveAndFlush(canonical);

        /*
         * Create source mapping.
         */
        QuestionSourceMapping sourceMapping =
                QuestionSourceMapping.builder()
                        .canonicalQuestion(canonical)
                        .source(QuestionSource.INTERNAL)
                        .sourceQuestionId(
                                String.valueOf(question.getId())
                        )
                        .sourceTitle(title)
                        .sourceUrl(
                                "/aptitude/" + question.getId()
                        )
                        .integrationMode(
                                SourceIntegrationMode.MANUAL_CURATION
                        )
                        .attribution(
                                "Authored directly in Prep2Place."
                        )
                        .lastSyncedAt(now)
                        .lastSeenAvailableAt(now)
                        .sourceAvailable(true)
                        .build();

        sourceMappingRepository.saveAndFlush(sourceMapping);

        /*
         * Link original aptitude question to canonical question.
         */
        question.setCanonicalQuestionId(canonical.getId());

        aptitudeQuestionRepository.saveAndFlush(question);

        log.info(
                "Linked aptitude question {} -> canonical question {}",
                question.getId(),
                canonical.getId()
        );

        return true;
    }
}