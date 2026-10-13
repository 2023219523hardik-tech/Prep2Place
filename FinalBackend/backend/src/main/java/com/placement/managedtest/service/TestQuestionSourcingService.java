package com.placement.managedtest.service;

import com.placement.entity.AptitudeQuestion;
import com.placement.entity.Difficulty;
import com.placement.exception.ApiException;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.*;
import com.placement.managedtest.repository.ManagedTestQuestionRepository;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import com.placement.repository.AptitudeQuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Everything to do with getting questions *out of* the Question Bank and *into* a test:
 * the unified picker search, the snapshot conversion, and the automatic selection rules.
 *
 * The Question Bank stays the single reusable source - this service only ever reads from it. The
 * one write path is the optional "also save to Question Bank" flag on a custom question, which
 * creates a new bank row and never mutates an existing one.
 */
@Service
@RequiredArgsConstructor
public class TestQuestionSourcingService {

    private final TechnicalMcqQuestionRepository technicalMcqRepository;
    private final AptitudeQuestionRepository aptitudeRepository;
    private final CanonicalQuestionRepository canonicalRepository;
    private final ManagedTestQuestionRepository questionRepository;

    private static final List<String> OPTION_KEYS = List.of("A", "B", "C", "D", "E", "F");

    // ------------------------------------------------------------------ picker search

    /**
     * Unified, paginated search across the three bank pools. Paging is per-pool (the caller picks a
     * sourceType) rather than a union, because a cross-pool union would need a materialized view to
     * page correctly and the picker UI already filters by source.
     */
    @Transactional(readOnly = true)
    public Page<BankQuestionResponse> searchBank(QuestionSourceType sourceType, String category, String topic,
                                                 String subtopic, Difficulty difficulty, String company,
                                                 String tag, String search, Long forTestId,
                                                 int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        Set<Long> alreadyInTest = forTestId == null
                ? Set.of()
                : new HashSet<>(questionRepository.findSourceIdsInTest(forTestId));

        return switch (sourceType) {
            case TECHNICAL_MCQ -> {
                TechnicalCategory cat = parseCategory(category);
                // company/tag are no longer Technical MCQ concepts (see
                // TechnicalMcqQuestion - both fields were removed), so they're deliberately not
                // passed through here even though this method's own signature still carries them
                // for the CANONICAL branch below, which still has a legitimate company filter.
                Page<TechnicalMcqQuestion> result = technicalMcqRepository.search(
                        cat, difficulty, blankToNull(topic), blankToNull(subtopic),
                        blankToNull(search), pageable);
                Map<Long, Long> usage = usageCounts(QuestionSourceType.TECHNICAL_MCQ,
                        result.getContent().stream().map(TechnicalMcqQuestion::getId).toList());
                yield result.map(q -> toBankResponse(q, usage, alreadyInTest));
            }
            case APTITUDE -> {
                // active=true (not null): the test builder's picker must never surface an
                // archived question for a new test - see AptitudeQuestionRepository.search's javadoc.
                Page<AptitudeQuestion> result = aptitudeRepository.search(
                        blankToNull(topic), difficulty, true, blankToNull(search), pageable);
                Map<Long, Long> usage = usageCounts(QuestionSourceType.APTITUDE,
                        result.getContent().stream().map(AptitudeQuestion::getId).toList());
                yield result.map(q -> toBankResponse(q, usage, alreadyInTest));
            }
            case CANONICAL -> {
                Page<CanonicalQuestion> result = canonicalRepository.search(
                        null, difficulty, blankToNull(topic), blankToNull(company), null,
                        blankToNull(search), pageable);
                Map<Long, Long> usage = usageCounts(QuestionSourceType.CANONICAL,
                        result.getContent().stream().map(CanonicalQuestion::getId).toList());
                yield result.map(q -> toBankResponse(q, usage, alreadyInTest));
            }
        };
    }

    private Map<Long, Long> usageCounts(QuestionSourceType type, List<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        Map<Long, Long> out = new HashMap<>();
        for (Object[] row : questionRepository.countUsageBySourceIds(type, ids)) {
            out.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return out;
    }

    // ------------------------------------------------------------------ snapshot conversion

    /**
     * Builds the in-test snapshot from a bank question. This is the only place the two
     * representations meet, which is what keeps "editing the copy never touches the original" true
     * by construction.
     */
    @Transactional(readOnly = true)
    public ManagedTestQuestion snapshotFromBank(QuestionSourceType sourceType, Long sourceId,
                                                ManagedTestSection section,
                                                Double marksOverride, Double negativeOverride) {
        return switch (sourceType) {
            case TECHNICAL_MCQ -> {
                TechnicalMcqQuestion q = technicalMcqRepository.findById(sourceId)
                        .orElseThrow(() -> ApiException.notFound("Technical MCQ " + sourceId + " not found"));
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("body", q.getQuestionText());
                payload.put("options", q.getOptions());
                payload.put("correctOptions", q.getCorrectOptions());
                payload.put("explanation", q.getExplanation());
                yield ManagedTestQuestion.builder()
                        .section(section)
                        .questionType(q.isMultipleCorrect() ? TestQuestionType.MCQ_MULTI : TestQuestionType.MCQ_SINGLE)
                        .origin(QuestionOrigin.QUESTION_BANK)
                        .sourceType(sourceType)
                        .sourceQuestionId(q.getId())
                        .title(truncate(q.getQuestionText(), 500))
                        .difficulty(q.getDifficulty())
                        .topic(q.getTopic() != null ? q.getTopic() : q.getCategory().label())
                        .subtopic(q.getSubtopic())
                        .marks(resolve(marksOverride, section.getMarksPerQuestion(), q.getDefaultMarks()))
                        .negativeMarks(resolve(negativeOverride, section.getNegativeMarks(), q.getDefaultNegativeMarks()))
                        .estimatedTimeSeconds(q.getEstimatedTimeSeconds())
                        .payload(payload)
                        .build();
            }
            case APTITUDE -> {
                AptitudeQuestion q = aptitudeRepository.findById(sourceId)
                        .orElseThrow(() -> ApiException.notFound("Aptitude question " + sourceId + " not found"));
                List<Map<String, String>> options = new ArrayList<>();
                addOption(options, "A", q.getOptionA());
                addOption(options, "B", q.getOptionB());
                addOption(options, "C", q.getOptionC());
                addOption(options, "D", q.getOptionD());
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("body", q.getText());
                payload.put("options", options);
                payload.put("correctOptions", q.getCorrectOption() == null ? List.of() : List.of(q.getCorrectOption()));
                payload.put("explanation", q.getExplanation());
                yield ManagedTestQuestion.builder()
                        .section(section)
                        .questionType(TestQuestionType.MCQ_SINGLE)
                        .origin(QuestionOrigin.QUESTION_BANK)
                        .sourceType(sourceType)
                        .sourceQuestionId(q.getId())
                        .title(truncate(q.getText(), 500))
                        .difficulty(q.getDifficulty())
                        .topic(q.getTopic())
                        .marks(resolve(marksOverride, section.getMarksPerQuestion(), 1d))
                        .negativeMarks(resolve(negativeOverride, section.getNegativeMarks(), 0d))
                        .estimatedTimeSeconds(60)
                        .payload(payload)
                        .build();
            }
            case CANONICAL -> {
                CanonicalQuestion q = canonicalRepository.findById(sourceId)
                        .orElseThrow(() -> ApiException.notFound("Question " + sourceId + " not found"));
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("body", q.getDescription());
                payload.put("inputFormat", q.getInputFormat());
                payload.put("outputFormat", q.getOutputFormat());
                payload.put("constraints", q.getConstraints());
                payload.put("examples", q.getExamples());
                payload.put("languages", q.getSupportedLanguages().isEmpty()
                        ? List.of("java", "python", "cpp") : q.getSupportedLanguages());
                // Canonical rows describe the problem, not its judge fixtures: an admin adds test
                // cases in the builder. Left empty (not fabricated) so validation catches it before publish.
                payload.put("testCases", new ArrayList<>());
                payload.put("starterCode", new LinkedHashMap<String, String>());
                yield ManagedTestQuestion.builder()
                        .section(section)
                        .questionType(TestQuestionType.CODING)
                        .origin(QuestionOrigin.QUESTION_BANK)
                        .sourceType(sourceType)
                        .sourceQuestionId(q.getId())
                        .title(truncate(q.getCanonicalTitle(), 500))
                        .difficulty(q.getDifficulty())
                        .topic(q.getTopics().isEmpty() ? null : q.getTopics().get(0))
                        .marks(resolve(marksOverride, section.getMarksPerQuestion(), 10d))
                        .negativeMarks(resolve(negativeOverride, section.getNegativeMarks(), 0d))
                        .estimatedTimeSeconds(1800)
                        .payload(payload)
                        .build();
            }
        };
    }

    // ------------------------------------------------------------------ automatic selection

    /**
     * Resolves a section's selection rules into concrete questions.
     *
     * Order of preference: category quotas, then difficulty quotas, then a top-up from the general
     * pool for whatever is still short. Anything already attached to the section (the manual half of
     * a HYBRID section) is excluded so the same question is never served twice.
     *
     * Returns the questions - persisting them is the caller's job.
     */
    @Transactional(readOnly = true)
    public AutoFillResult autoSelect(ManagedTestSection section, AutoFillRequest request, Set<Long> excludeSourceIds) {
        QuestionSourceType sourceType = request.sourceType() != null
                ? request.sourceType() : defaultSourceFor(section.getSectionType());

        int target = request.count() != null ? request.count()
                : Math.max(section.getQuestionCount() - section.getQuestions().size(), 0);
        if (target <= 0) return new AutoFillResult(List.of(), 0, 0, List.of("Nothing to fill: target count is zero."));

        List<String> notes = new ArrayList<>();
        Set<Long> used = new HashSet<>(excludeSourceIds);
        List<ManagedTestQuestion> picked = new ArrayList<>();

        Map<String, Integer> categories = request.categoryDistribution() == null ? Map.of() : request.categoryDistribution();
        for (Map.Entry<String, Integer> entry : categories.entrySet()) {
            int want = entry.getValue() == null ? 0 : entry.getValue();
            List<Long> ids = poolIds(sourceType, entry.getKey(), null, used);
            int took = take(ids, want, used, section, picked, sourceType);
            if (took < want) notes.add("Only " + took + " of " + want + " questions available for " + entry.getKey() + ".");
        }

        Map<String, Integer> difficulties = request.difficultyDistribution() == null ? Map.of() : request.difficultyDistribution();
        for (Map.Entry<String, Integer> entry : difficulties.entrySet()) {
            int want = entry.getValue() == null ? 0 : entry.getValue();
            Difficulty difficulty = parseDifficulty(entry.getKey());
            List<Long> ids = poolIds(sourceType, null, difficulty, used);
            int took = take(ids, want, used, section, picked, sourceType);
            if (took < want) notes.add("Only " + took + " of " + want + " " + entry.getKey() + " questions available.");
        }

        if (picked.size() < target) {
            List<Long> ids = poolIds(sourceType, null, null, used);
            take(ids, target - picked.size(), used, section, picked, sourceType);
        }

        int shortfall = Math.max(target - picked.size(), 0);
        if (shortfall > 0) {
            notes.add("The Question Bank could not supply " + shortfall
                    + " more matching question(s). Add them manually or widen the rules.");
        }
        return new AutoFillResult(picked, picked.size(), shortfall, notes);
    }

    public record AutoFillResult(List<ManagedTestQuestion> questions, int added, int shortfall, List<String> notes) {}

    private int take(List<Long> candidateIds, int want, Set<Long> used, ManagedTestSection section,
                     List<ManagedTestQuestion> sink, QuestionSourceType sourceType) {
        if (want <= 0) return 0;
        List<Long> shuffled = new ArrayList<>(candidateIds);
        shuffled.removeAll(used);
        Collections.shuffle(shuffled);
        int took = 0;
        for (Long id : shuffled) {
            if (took >= want) break;
            sink.add(snapshotFromBank(sourceType, id, section, null, null));
            used.add(id);
            took++;
        }
        return took;
    }

    private List<Long> poolIds(QuestionSourceType sourceType, String category, Difficulty difficulty, Set<Long> used) {
        return switch (sourceType) {
            case TECHNICAL_MCQ -> technicalMcqRepository.findPool(parseCategory(category), difficulty)
                    .stream().map(TechnicalMcqQuestion::getId).filter(id -> !used.contains(id)).toList();
            case APTITUDE -> aptitudeRepository.findPool(category, difficulty)
                    .stream().map(AptitudeQuestion::getId).filter(id -> !used.contains(id)).toList();
            case CANONICAL -> canonicalRepository.findAvailableCandidatePool(
                            com.placement.questionbank.entity.QuestionDomain.CODING, difficulty)
                    .stream().map(CanonicalQuestion::getId).filter(id -> !used.contains(id)).toList();
        };
    }

    public QuestionSourceType defaultSourceFor(SectionType sectionType) {
        return switch (sectionType) {
            case APTITUDE -> QuestionSourceType.APTITUDE;
            case CODING, DSA -> QuestionSourceType.CANONICAL;
            default -> QuestionSourceType.TECHNICAL_MCQ;
        };
    }

    // ------------------------------------------------------------------ write-back to the bank

    /**
     * Optional "save to Question Bank for future use". Always creates a NEW bank row; it never
     * updates an existing one, so a custom question written during test authoring can't overwrite
     * something another test depends on.
     */
    @Transactional
    public Long publishCustomQuestionToBank(CustomQuestionRequest request) {
        if (request.questionType() != TestQuestionType.MCQ_SINGLE && request.questionType() != TestQuestionType.MCQ_MULTI) {
            // Coding/SQL/DataFrame questions have no bank table of their own yet; they stay test-local.
            return null;
        }
        Map<String, Object> p = request.payload();
        TechnicalCategory category = parseCategory(request.bankCategory());
        if (category == null) throw ApiException.badRequest("A Question Bank category is required to save this question to the bank.");

        TechnicalMcqQuestion entity = TechnicalMcqQuestion.builder()
                .questionText(String.valueOf(p.getOrDefault("body", request.title())))
                .category(category)
                .topic(request.topic())
                .subtopic(request.subtopic())
                .difficulty(request.difficulty() != null ? request.difficulty() : Difficulty.MEDIUM)
                .options(castOptions(p.get("options")))
                .correctOptions(castStrings(p.get("correctOptions")))
                .multipleCorrect(request.questionType() == TestQuestionType.MCQ_MULTI)
                .explanation(p.get("explanation") == null ? null : String.valueOf(p.get("explanation")))
                .defaultMarks(request.marks() != null ? request.marks() : 1d)
                .defaultNegativeMarks(request.negativeMarks() != null ? request.negativeMarks() : 0d)
                .estimatedTimeSeconds(request.estimatedTimeSeconds() != null ? request.estimatedTimeSeconds() : 60)
                .sourceRef("admin-custom-" + UUID.randomUUID())
                .build();
        return technicalMcqRepository.save(entity).getId();
    }

    // ------------------------------------------------------------------ facets

    @Transactional(readOnly = true)
    public BankFacetsResponse facets() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : technicalMcqRepository.countGroupedByCategory()) {
            counts.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        return new BankFacetsResponse(
                Arrays.stream(TechnicalCategory.values()).map(Enum::name).toList(),
                aptitudeRepository.findDistinctTopics(),
                Arrays.stream(Difficulty.values()).map(Enum::name).toList(),
                Arrays.stream(QuestionSourceType.values()).map(Enum::name).toList(),
                counts
        );
    }

    // ------------------------------------------------------------------ helpers

    private BankQuestionResponse toBankResponse(TechnicalMcqQuestion q, Map<Long, Long> usage, Set<Long> inTest) {
        return new BankQuestionResponse(
                q.getId(), QuestionSourceType.TECHNICAL_MCQ, truncate(q.getQuestionText(), 160),
                truncate(q.getQuestionText(), 400),
                q.isMultipleCorrect() ? TestQuestionType.MCQ_MULTI : TestQuestionType.MCQ_SINGLE,
                q.getCategory().name(), q.getTopic(), q.getSubtopic(), q.getDifficulty(),
                q.getDefaultMarks(), q.getDefaultNegativeMarks(), List.of(), List.of(),
                "QUESTION_BANK", usage.getOrDefault(q.getId(), 0L), inTest.contains(q.getId())
        );
    }

    private BankQuestionResponse toBankResponse(AptitudeQuestion q, Map<Long, Long> usage, Set<Long> inTest) {
        return new BankQuestionResponse(
                q.getId(), QuestionSourceType.APTITUDE, truncate(q.getText(), 160), truncate(q.getText(), 400),
                TestQuestionType.MCQ_SINGLE, "APTITUDE", q.getTopic(), null, q.getDifficulty(),
                1d, 0d, List.of(), List.of(), "APTITUDE_BANK",
                usage.getOrDefault(q.getId(), 0L), inTest.contains(q.getId())
        );
    }

    private BankQuestionResponse toBankResponse(CanonicalQuestion q, Map<Long, Long> usage, Set<Long> inTest) {
        return new BankQuestionResponse(
                q.getId(), QuestionSourceType.CANONICAL, q.getCanonicalTitle(),
                truncate(q.getDescription(), 400), TestQuestionType.CODING,
                q.getDomain().name(), q.getTopics().isEmpty() ? null : q.getTopics().get(0), null,
                q.getDifficulty(), 10d, 0d, q.getCompanies(), q.getTags(), "CANONICAL",
                usage.getOrDefault(q.getId(), 0L), inTest.contains(q.getId())
        );
    }

    private void addOption(List<Map<String, String>> options, String key, String text) {
        if (text != null && !text.isBlank()) options.add(Map.of("key", key, "text", text));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> castOptions(Object raw) {
        if (raw instanceof List<?> list) {
            List<Map<String, String>> out = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    String key = m.get("key") != null ? String.valueOf(m.get("key")) : OPTION_KEYS.get(Math.min(i, OPTION_KEYS.size() - 1));
                    out.add(Map.of("key", key, "text", String.valueOf(m.get("text"))));
                } else {
                    out.add(Map.of("key", OPTION_KEYS.get(Math.min(i, OPTION_KEYS.size() - 1)), "text", String.valueOf(o)));
                }
                i++;
            }
            return out;
        }
        return new ArrayList<>();
    }

    private List<String> castStrings(Object raw) {
        if (raw instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        if (raw instanceof String s) return List.of(s);
        return new ArrayList<>();
    }

    private double resolve(Double override, double sectionDefault, double bankDefault) {
        if (override != null) return override;
        if (sectionDefault > 0) return sectionDefault;
        return bankDefault;
    }

    private TechnicalCategory parseCategory(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return TechnicalCategory.valueOf(raw.trim().toUpperCase().replace('-', '_').replace(' ', '_'));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Difficulty parseDifficulty(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Difficulty.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String blankToNull(String s) { return s == null || s.isBlank() ? null : s; }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}