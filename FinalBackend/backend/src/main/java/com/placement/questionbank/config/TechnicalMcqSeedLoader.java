package com.placement.questionbank.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.Difficulty;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Order(30)
@Slf4j
public class TechnicalMcqSeedLoader implements ApplicationRunner {

    private final TechnicalMcqQuestionRepository repository;
    private final PlatformTransactionManager transactionManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** {@code @JsonIgnoreProperties(ignoreUnknown = true)}: the seed file is a PDF-extraction
     *  pipeline export, and every record carries a "_source" provenance block (sourceType,
     *  sourceName, sourceUrl, sourceLocation) documenting which PDF/page the question came from -
     *  useful for the export tooling, not something this entity has a column for. Without this
     *  annotation, Jackson's default FAIL_ON_UNKNOWN_PROPERTIES means a single unrecognized field
     *  anywhere in the array fails the *entire* readValue() call (see load()'s catch block), so one
     *  extra field silently zeroes out all 198 seeded questions rather than just skipping one bad
     *  row - ignoring unknown fields here is what makes "extra metadata we don't map" safe instead
     *  of catastrophic. */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record Seed(
            String sourceRef,
            String category,
            String topic,
            String subtopic,
            String difficulty,
            String questionText,
            List<Map<String, String>> options,
            List<String> correctOptions,
            Boolean multipleCorrect,
            String explanation,
            Double defaultMarks,
            Double defaultNegativeMarks,
            Integer estimatedTimeSeconds
    ) {
    }

    @Override
    public void run(ApplicationArguments args) {

        List<Seed> seeds = load();

        if (seeds.isEmpty()) {
            log.warn("Technical MCQ seed contains no questions. Nothing to import.");
            return;
        }

        int created = 0;
        int updated = 0;
        int unchanged = 0;
        int failed = 0;

        // Each row gets its OWN transaction (REQUIRES_NEW), not one shared transaction for all
        // 198 rows. This matters because a flush failure inside Hibernate marks the *whole*
        // session/transaction rollback-only at the JDBC layer - a Java try/catch around the loop
        // body catches the exception and lets the loop continue, but it can't undo that mark.
        // Every subsequent query in the same session then auto-flushes the still-dirty broken
        // entity from the failed row and throws HHH000099 ("don't flush the Session after an
        // exception occurs"), cascading one bad row into every row that runs after it - and since
        // the shared transaction is rollback-only, nothing commits at all when run() returns,
        // even for rows that were perfectly fine. A REQUIRES_NEW transaction per row means a bad
        // row rolls back only itself; every other row's commit is untouched.
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        for (Seed seed : seeds) {
            try {
                RowOutcome outcome = txTemplate.execute(status -> importOne(seed));
                switch (outcome) {
                    case CREATED -> created++;
                    case UPDATED -> updated++;
                    case UNCHANGED -> unchanged++;
                    case SKIPPED -> failed++;
                }
            } catch (Exception e) {
                failed++;
                log.error(
                        "Failed to import Technical MCQ. sourceRef={}, error={}",
                        seed.sourceRef(),
                        e.getMessage(),
                        e
                );
            }
        }

        log.info(
                "Technical MCQ seed synchronization completed: " +
                        "{} created, {} updated, {} unchanged, {} failed",
                created,
                updated,
                unchanged,
                failed
        );
    }

    private enum RowOutcome { CREATED, UPDATED, UNCHANGED, SKIPPED }

    /** Runs inside its own REQUIRES_NEW transaction (see run()'s comment) - a thrown exception
     *  here rolls back only this one row and propagates out to run()'s catch block, it can no
     *  longer poison the session for rows that come after it. */
    private RowOutcome importOne(Seed seed) {

        if (seed.sourceRef() == null || seed.sourceRef().isBlank()) {
            log.warn(
                    "Skipping Technical MCQ because sourceRef is missing. Question={}",
                    seed.questionText()
            );
            return RowOutcome.SKIPPED;
        }

        // category is NOT NULL in the DB (see TechnicalMcqQuestion.category), but resolveCategory
        // returns null for a blank or unrecognized value - its own javadoc says that's meant to
        // avoid "throwing an unexpected NullPointerException", but returning null here and then
        // still trying to save() just defers the crash to a DataIntegrityViolationException at
        // insert time instead. Checking here makes that stated intent actually hold: a genuinely
        // uncategorized row (this seed file's PDF-extraction pipeline left ~100 rows with
        // category: "" for its last, cloud/security-themed batch) is skipped and logged with
        // enough detail to fix it later - either by backfilling the source JSON or adding the
        // category by hand through the admin UI - rather than crashing this row's transaction.
        if (resolveCategory(seed.category()) == null) {
            log.warn(
                    "Skipping Technical MCQ because category is missing or unrecognized. " +
                            "sourceRef={}, category='{}', questionText={}",
                    seed.sourceRef(),
                    seed.category(),
                    seed.questionText()
            );
            return RowOutcome.SKIPPED;
        }

        Optional<TechnicalMcqQuestion> existing =
                repository.findBySourceRef(seed.sourceRef());

        if (existing.isPresent()) {

            TechnicalMcqQuestion question = existing.get();

            boolean changed = updateEntity(question, seed);

            if (changed) {
                repository.save(question);

                log.debug(
                        "Technical MCQ updated: sourceRef={}",
                        seed.sourceRef()
                );
                return RowOutcome.UPDATED;
            }
            return RowOutcome.UNCHANGED;

        } else {

            TechnicalMcqQuestion question = toEntity(seed);

            repository.save(question);

            log.debug(
                    "Technical MCQ created: sourceRef={}",
                    seed.sourceRef()
            );
            return RowOutcome.CREATED;
        }
    }

    public List<Seed> load() {

        try (
                InputStream is =
                        new ClassPathResource(
                                "seed-data/technical-mcq-questions.json"
                        ).getInputStream()
        ) {

            return objectMapper.readValue(
                    is,
                    objectMapper.getTypeFactory()
                            .constructCollectionType(List.class, Seed.class)
            );

        } catch (IOException e) {

            log.error(
                    "Could not load technical-mcq-questions.json: {}",
                    e.getMessage(),
                    e
            );

            return List.of();
        }
    }

    /**
     * Creates a new database entity from the JSON seed.
     */
    public TechnicalMcqQuestion toEntity(Seed seed) {

        return TechnicalMcqQuestion.builder()
                .sourceRef(seed.sourceRef())
                .questionText(seed.questionText())
                .category(resolveCategory(seed.category()))
                .topic(seed.topic())
                .subtopic(seed.subtopic())
                .difficulty(resolveDifficulty(seed.difficulty()))
                .options(
                        seed.options() == null
                                ? new ArrayList<>()
                                : new ArrayList<>(seed.options())
                )
                .correctOptions(
                        seed.correctOptions() == null
                                ? new ArrayList<>()
                                : new ArrayList<>(seed.correctOptions())
                )
                .multipleCorrect(
                        Boolean.TRUE.equals(seed.multipleCorrect())
                )
                .explanation(seed.explanation())
                .defaultMarks(
                        seed.defaultMarks() == null
                                ? 1d
                                : seed.defaultMarks()
                )
                .defaultNegativeMarks(
                        seed.defaultNegativeMarks() == null
                                ? 0d
                                : seed.defaultNegativeMarks()
                )
                .estimatedTimeSeconds(
                        seed.estimatedTimeSeconds() == null
                                ? 60
                                : seed.estimatedTimeSeconds()
                )
                .active(true)
                .build();
    }

    /**
     * Updates an existing entity without changing:
     *
     * - database ID
     * - sourceRef
     * - createdAt
     *
     * Returns true when at least one value changed.
     */
    private boolean updateEntity(
            TechnicalMcqQuestion question,
            Seed seed
    ) {

        boolean changed = false;

        if (!equals(question.getQuestionText(), seed.questionText())) {
            question.setQuestionText(seed.questionText());
            changed = true;
        }

        TechnicalCategory category =
                resolveCategory(seed.category());

        if (question.getCategory() != category) {
            question.setCategory(category);
            changed = true;
        }

        if (!equals(question.getTopic(), seed.topic())) {
            question.setTopic(seed.topic());
            changed = true;
        }

        if (!equals(question.getSubtopic(), seed.subtopic())) {
            question.setSubtopic(seed.subtopic());
            changed = true;
        }

        Difficulty difficulty =
                resolveDifficulty(seed.difficulty());

        if (question.getDifficulty() != difficulty) {
            question.setDifficulty(difficulty);
            changed = true;
        }

        List<Map<String, String>> options =
                seed.options() == null
                        ? new ArrayList<>()
                        : new ArrayList<>(seed.options());

        if (!equals(question.getOptions(), options)) {
            question.setOptions(options);
            changed = true;
        }

        List<String> correctOptions =
                seed.correctOptions() == null
                        ? new ArrayList<>()
                        : new ArrayList<>(seed.correctOptions());

        if (!equals(question.getCorrectOptions(), correctOptions)) {
            question.setCorrectOptions(correctOptions);
            changed = true;
        }

        boolean multipleCorrect =
                Boolean.TRUE.equals(seed.multipleCorrect());

        if (question.isMultipleCorrect() != multipleCorrect) {
            question.setMultipleCorrect(multipleCorrect);
            changed = true;
        }

        if (!equals(question.getExplanation(), seed.explanation())) {
            question.setExplanation(seed.explanation());
            changed = true;
        }

        double defaultMarks =
                seed.defaultMarks() == null
                        ? 1d
                        : seed.defaultMarks();

        if (Double.compare(
                question.getDefaultMarks(),
                defaultMarks
        ) != 0) {

            question.setDefaultMarks(defaultMarks);
            changed = true;
        }

        double defaultNegativeMarks =
                seed.defaultNegativeMarks() == null
                        ? 0d
                        : seed.defaultNegativeMarks();

        if (Double.compare(
                question.getDefaultNegativeMarks(),
                defaultNegativeMarks
        ) != 0) {

            question.setDefaultNegativeMarks(
                    defaultNegativeMarks
            );

            changed = true;
        }

        int estimatedTime =
                seed.estimatedTimeSeconds() == null
                        ? 60
                        : seed.estimatedTimeSeconds();

        if (question.getEstimatedTimeSeconds() != estimatedTime) {
            question.setEstimatedTimeSeconds(estimatedTime);
            changed = true;
        }

        return changed;
    }

    /**
     * Resolves category safely.
     *
     * Empty/null categories are treated as invalid seed data rather than
     * throwing an unexpected NullPointerException.
     */
    private TechnicalCategory resolveCategory(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return TechnicalCategory.valueOf(
                    value.trim().toUpperCase()
            );
        } catch (IllegalArgumentException e) {

            log.warn(
                    "Unknown Technical MCQ category '{}'. " +
                            "Question will be imported with null category.",
                    value
            );

            return null;
        }
    }

    /**
     * Resolves difficulty.
     *
     * Missing/invalid difficulty defaults to MEDIUM.
     */
    private Difficulty resolveDifficulty(String value) {

        if (value == null || value.isBlank()) {
            return Difficulty.MEDIUM;
        }

        try {
            return Difficulty.valueOf(
                    value.trim().toUpperCase()
            );
        } catch (IllegalArgumentException e) {

            log.warn(
                    "Unknown Technical MCQ difficulty '{}'. " +
                            "Defaulting to MEDIUM.",
                    value
            );

            return Difficulty.MEDIUM;
        }
    }

    private boolean equals(Object a, Object b) {
        return java.util.Objects.equals(a, b);
    }
}