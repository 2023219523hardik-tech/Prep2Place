package com.placement.service;

import com.placement.dto.AdminDtos.*;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final JobRoleRepository jobRoleRepository;
    private final CodingSubmissionRepository codingSubmissionRepository;
    private final AptitudeAttemptRepository aptitudeAttemptRepository;
    private final InterviewSessionRepository interviewSessionRepository;
    private final ScoreWeightConfigRepository weightConfigRepository;
    private final ReadinessService readinessService;
    private final SkillGapService skillGapService;
    private final com.placement.repository.AptitudeQuestionRepository aptitudeQuestionRepository;
    private final com.placement.config.AptitudeQuestionSeedLoader aptitudeQuestionSeedLoader;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public Page<User> listStudents(int page, int size, String search) {
        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .filter(u -> search == null || search.isBlank()
                        || u.getFullName().toLowerCase().contains(search.toLowerCase())
                        || u.getEmail().toLowerCase().contains(search.toLowerCase()))
                .toList();
        int from = Math.min(page * size, students.size());
        int to = Math.min(from + size, students.size());
        return new org.springframework.data.domain.PageImpl<>(students.subList(from, to), PageRequest.of(page, size), students.size());
    }

    public AdminStatsResponse getStats() {
        List<User> students = userRepository.findAll().stream().filter(u -> u.getRole() == Role.STUDENT).toList();
        long total = students.size();
        long active = students.stream().filter(User::isActive).count();

        List<Double> readinessScores = students.stream()
                .map(s -> { try { return readinessService.analyze(s).overallScore(); } catch (Exception e) { return 0.0; } })
                .toList();

        long ready = readinessScores.stream().filter(sc -> sc >= 60).count();
        long needsImprovement = total - ready;
        double avgReadiness = readinessScores.stream().mapToDouble(Double::doubleValue).average().orElse(0);

        double avgCoding = codingSubmissionRepository.findAll().stream().mapToInt(CodingSubmission::getScore).average().orElse(0);
        double avgAptitude = students.stream().mapToDouble(s -> {
            List<AptitudeAttempt> attempts = aptitudeAttemptRepository.findByStudentIdOrderByAttemptedAtDesc(s.getId());
            if (attempts.isEmpty()) return 0;
            return (attempts.stream().filter(AptitudeAttempt::isCorrect).count() * 100.0) / attempts.size();
        }).average().orElse(0);
        double avgInterview = interviewSessionRepository.findAll().stream().filter(s -> s.getOverallScore() != null)
                .mapToDouble(InterviewSession::getOverallScore).average().orElse(0);

        Map<String, Long> gapCounts = students.stream()
                .flatMap(s -> {
                    try { return skillGapService.analyze(s, null).missingSkills().stream(); }
                    catch (Exception e) { return java.util.stream.Stream.<String>empty(); }
                })
                .collect(Collectors.groupingBy(sk -> sk, Collectors.counting()));

        List<String> topGaps = gapCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue())).limit(5).map(Map.Entry::getKey).toList();

        return new AdminStatsResponse(total, active, ready, needsImprovement,
                round(avgReadiness), round(avgCoding), round(avgAptitude), round(avgInterview), topGaps);
    }

    @Transactional
    public void setStudentActive(Long studentId, boolean active) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        user.setActive(active);
        userRepository.save(user);
    }

    @Transactional
    public Question createQuestion(CreateQuestionRequest req) {
        JobRole role = req.roleId() == null ? null :
                jobRoleRepository.findById(req.roleId()).orElseThrow(() -> ApiException.notFound("Job role not found"));
        Question q = Question.builder()
                .text(req.text()).category(QuestionCategory.valueOf(req.category().toUpperCase()))
                .difficulty(Difficulty.valueOf(req.difficulty().toUpperCase())).role(role)
                .expectedKeywords(req.expectedKeywords()).published(true).build();
        return questionRepository.save(q);
    }

    @Transactional
    public List<Question> bulkCreateQuestions(BulkQuestionUploadRequest req) {
        return req.questions().stream().map(this::createQuestion).toList();
    }

    @Transactional
    public Question updateQuestion(Long id, CreateQuestionRequest req) {
        Question q = questionRepository.findById(id).orElseThrow(() -> ApiException.notFound("Question not found"));
        if (req.text() != null) q.setText(req.text());
        if (req.category() != null) q.setCategory(QuestionCategory.valueOf(req.category().toUpperCase()));
        if (req.difficulty() != null) q.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        if (req.expectedKeywords() != null) q.setExpectedKeywords(req.expectedKeywords());
        if (req.roleId() != null) q.setRole(jobRoleRepository.findById(req.roleId()).orElseThrow(() -> ApiException.notFound("Job role not found")));
        return questionRepository.save(q);
    }

    @Transactional
    public void deleteQuestion(Long id) { questionRepository.deleteById(id); }

    @Transactional
    public Question setQuestionStatus(Long id, boolean published) {
        Question q = questionRepository.findById(id).orElseThrow(() -> ApiException.notFound("Question not found"));
        q.setPublished(published);
        return questionRepository.save(q);
    }

    @Transactional
    public JobRole createRole(CreateJobRoleRequest req) {
        JobRole role = JobRole.builder().title(req.title()).domain(req.domain())
                .description(req.description()).requiredSkills(req.requiredSkills()).build();
        return jobRoleRepository.save(role);
    }

    @Transactional
    public ScoreWeightConfig updateWeights(ScoreWeightConfigRequest req) {
        ScoreWeightConfig config = weightConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> ScoreWeightConfig.builder().build());
        if (req.correctnessWeight() != null) config.setCorrectnessWeight(req.correctnessWeight());
        if (req.clarityWeight() != null) config.setClarityWeight(req.clarityWeight());
        if (req.confidenceWeight() != null) config.setConfidenceWeight(req.confidenceWeight());
        if (req.structureWeight() != null) config.setStructureWeight(req.structureWeight());
        if (req.depthWeight() != null) config.setDepthWeight(req.depthWeight());
        if (req.dsaWeight() != null) config.setDsaWeight(req.dsaWeight());
        if (req.aptitudeWeight() != null) config.setAptitudeWeight(req.aptitudeWeight());
        if (req.technicalWeight() != null) config.setTechnicalWeight(req.technicalWeight());
        if (req.communicationWeight() != null) config.setCommunicationWeight(req.communicationWeight());
        if (req.interviewWeight() != null) config.setInterviewWeight(req.interviewWeight());
        if (req.projectsWeight() != null) config.setProjectsWeight(req.projectsWeight());
        if (req.academicsWeight() != null) config.setAcademicsWeight(req.academicsWeight());
        return weightConfigRepository.save(config);
    }

    public List<FlaggedInterviewResponse> getFlaggedInterviews() {
        return interviewSessionRepository.findByFlaggedForReviewTrueOrderByCompletedAtDesc().stream()
                .map(s -> new FlaggedInterviewResponse(
                        s.getId(), s.getStudent().getFullName(), s.getStudent().getEmail(),
                        s.getRole() != null ? s.getRole().getTitle() : "General",
                        s.getIntegrityScore(),
                        s.getCompletedAt() != null ? s.getCompletedAt().toString() : null))
                .toList();
    }

    /**
     * Bulk-add aptitude/quant/reasoning questions from structured JSON (same shape as
     * resources/seed-data/aptitude-questions.json). Per-row tolerant: a bad row is skipped and
     * logged rather than aborting the whole batch. Duplicate detection uses question text so
     * re-uploading the same file does not create duplicate rows.
     */
    @Transactional
    public java.util.Map<String, Object> bulkCreateAptitudeQuestions(
            List<com.placement.config.AptitudeQuestionSeedLoader.AptitudeQuestionSeed> seeds) {
        int inserted = 0, skipped = 0, failed = 0;
        java.util.List<String> failures = new java.util.ArrayList<>();
        java.util.Set<String> seenTexts = new java.util.HashSet<>();
        for (int i = 0; i < seeds.size(); i++) {
            com.placement.config.AptitudeQuestionSeedLoader.AptitudeQuestionSeed seed = seeds.get(i);
            if (seed == null || seed.text() == null || seed.text().isBlank()) {
                failed++;
                failures.add("Row " + (i + 1) + ": question text is required.");
                continue;
            }
            String text = seed.text().trim();
            if (!seenTexts.add(text) || aptitudeQuestionRepository.existsByText(text)) {
                skipped++;
                continue;
            }
            try {
                com.placement.entity.AptitudeQuestion entity = aptitudeQuestionSeedLoader.toEntity(seed);
                if (entity == null) {
                    failed++;
                    failures.add("Row " + (i + 1) + ": invalid or missing difficulty.");
                    continue;
                }
                aptitudeQuestionRepository.save(entity);
                inserted++;
            } catch (Exception ex) {
                failed++;
                failures.add("Row " + (i + 1) + ": " + ex.getMessage());
            }
        }
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("total", seeds.size());
        result.put("inserted", inserted);
        result.put("skipped", skipped);
        result.put("duplicates", skipped);
        result.put("failed", failed);
        result.put("failures", failures);
        return result;
    }

    // --------------------------------------------------------------------- aptitude question CRUD --
    // Everything below is new: previously AptitudeQuestion had only listQuestions() and
    // bulkCreateAptitudeQuestions() above - no single create, no update (so a correct-answer fix
    // could never reach Postgres), no delete/archive. Mirrors TechnicalMcqAdminService's shape in
    // the questionbank module, adapted to this entity's single optionA-D + active flag (no jsonb).

    @Transactional
    public com.placement.entity.AptitudeQuestion createAptitudeQuestion(AptitudeQuestionUpsertRequest req) {
        validateAptitudeQuestion(req);
        com.placement.entity.AptitudeQuestion q = com.placement.entity.AptitudeQuestion.builder()
                .active(true)
                .build();
        applyAptitudeQuestion(q, req);
        com.placement.entity.AptitudeQuestion saved = aptitudeQuestionRepository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_CREATED",
                "AptitudeQuestion", saved.getId(), saved.getText());
        return saved;
    }

    @Transactional
    public com.placement.entity.AptitudeQuestion updateAptitudeQuestion(Long id, AptitudeQuestionUpsertRequest req) {
        validateAptitudeQuestion(req);
        com.placement.entity.AptitudeQuestion q = aptitudeQuestionRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Aptitude question not found"));
        applyAptitudeQuestion(q, req);
        // Explicit save so the response the controller returns reflects exactly what was persisted,
        // not a stale in-memory copy - the same guarantee CreateQuestionRequest's updateQuestion()
        // above relies on the JPA dirty-check for, made explicit here since this is the method the
        // "admin changes B -> D, Postgres must contain D" requirement is specifically about.
        com.placement.entity.AptitudeQuestion saved = aptitudeQuestionRepository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_UPDATED",
                "AptitudeQuestion", saved.getId(), null);
        return saved;
    }

    /** Default delete: soft (active=false). Safe and reversible regardless of whether the question
     *  has ever been attempted - see deleteAptitudeQuestionPermanently for the destructive path and
     *  why it needs a reference check first. */
    @Transactional
    public com.placement.entity.AptitudeQuestion archiveAptitudeQuestion(Long id) {
        com.placement.entity.AptitudeQuestion q = aptitudeQuestionRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Aptitude question not found"));
        q.setActive(false);
        com.placement.entity.AptitudeQuestion saved = aptitudeQuestionRepository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_ARCHIVED",
                "AptitudeQuestion", saved.getId(), null);
        return saved;
    }

    @Transactional
    public com.placement.entity.AptitudeQuestion reactivateAptitudeQuestion(Long id) {
        com.placement.entity.AptitudeQuestion q = aptitudeQuestionRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Aptitude question not found"));
        q.setActive(true);
        com.placement.entity.AptitudeQuestion saved = aptitudeQuestionRepository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_REACTIVATED",
                "AptitudeQuestion", saved.getId(), null);
        return saved;
    }

    /** aptitude_attempt.question_id is a non-nullable FK to this table with no ON DELETE clause, so
     *  deleting a question any student has attempted would otherwise fail as a raw
     *  DataIntegrityViolationException (a generic "record already exists" 409 from
     *  GlobalExceptionHandler - misleading for a delete). Checking first lets us give the exact
     *  message the spec's own error-handling example calls for: "referenced by N attempts, archive
     *  instead". */
    @Transactional
    public void deleteAptitudeQuestionPermanently(Long id) {
        if (!aptitudeQuestionRepository.existsById(id)) {
            throw ApiException.notFound("Aptitude question not found");
        }
        long attemptCount = aptitudeAttemptRepository.countByQuestion_Id(id);
        if (attemptCount > 0) {
            throw ApiException.conflict("Unable to delete question. It is referenced by "
                    + attemptCount + " student attempt" + (attemptCount == 1 ? "" : "s")
                    + ". Archive it instead.");
        }
        aptitudeQuestionRepository.deleteById(id);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_DELETED",
                "AptitudeQuestion", id, "Permanent delete");
    }

    private void applyAptitudeQuestion(com.placement.entity.AptitudeQuestion q, AptitudeQuestionUpsertRequest req) {
        q.setText(req.text());
        q.setTopic(req.topic());
        q.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        q.setOptionA(req.optionA());
        q.setOptionB(req.optionB());
        q.setOptionC(req.optionC());
        q.setOptionD(req.optionD());
        q.setCorrectOption(req.correctOption().toUpperCase());
        q.setExplanation(req.explanation());
    }

    /** Same reasoning as TechnicalMcqAdminService.validate(): this is the one place every create and
     *  every update passes through, so "Option C is empty" / "invalid correct answer" are caught
     *  here rather than trusted to whatever the admin form happens to send. */
    private void validateAptitudeQuestion(AptitudeQuestionUpsertRequest req) {
        List<String> errors = new java.util.ArrayList<>();

        if (isBlank(req.text())) errors.add("Question text is required.");
        if (isBlank(req.topic())) errors.add("Topic is required.");
        if (isBlank(req.difficulty())) {
            errors.add("Difficulty is required.");
        } else {
            try {
                Difficulty.valueOf(req.difficulty().toUpperCase());
            } catch (IllegalArgumentException ex) {
                errors.add("\"" + req.difficulty() + "\" is not a valid difficulty.");
            }
        }

        Map<String, String> options = new java.util.LinkedHashMap<>();
        if (!isBlank(req.optionA())) options.put("A", req.optionA());
        if (!isBlank(req.optionB())) options.put("B", req.optionB());
        if (!isBlank(req.optionC())) options.put("C", req.optionC());
        if (!isBlank(req.optionD())) options.put("D", req.optionD());
        if (isBlank(req.optionA())) errors.add("Option A is empty.");
        if (isBlank(req.optionB())) errors.add("Option B is empty.");
        if (options.size() < 2) errors.add("At least two options are required.");

        if (isBlank(req.correctOption())) {
            errors.add("A correct option must be selected.");
        } else if (!options.containsKey(req.correctOption().toUpperCase())) {
            errors.add("Correct answer \"" + req.correctOption() + "\" does not match a non-empty option.");
        }

        if (!errors.isEmpty()) {
            throw ApiException.badRequest(String.join(" ", errors));
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private double round(double v) { return Math.round(v * 10.0) / 10.0; }
}