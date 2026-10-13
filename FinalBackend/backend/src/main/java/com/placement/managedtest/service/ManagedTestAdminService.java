package com.placement.managedtest.service;

import com.placement.assessment.entity.AttemptStatus;
import com.placement.entity.JobRole;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.*;
import com.placement.managedtest.repository.*;
import com.placement.repository.JobRoleRepository;
import com.placement.repository.UserRepository;
import com.placement.service.AuditLogService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/** Admin-side authoring: test CRUD, sections, questions, publishing, assignment. */
@Service
@RequiredArgsConstructor
public class ManagedTestAdminService {

    private final ManagedTestRepository testRepository;
    private final ManagedTestSectionRepository sectionRepository;
    private final ManagedTestQuestionRepository questionRepository;
    private final ManagedTestAssignmentRepository assignmentRepository;
    private final ManagedTestAttemptRepository attemptRepository;
    private final JobRoleRepository jobRoleRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final TestQuestionSourcingService sourcingService;
    private final ManagedTestValidationService validationService;
    private final ManagedTestMapper mapper;

    // ------------------------------------------------------------------ tests

    @Transactional(readOnly = true)
    public Page<TestSummaryResponse> list(TestStatus status, TestType type, String search, int page, int size) {
        Page<ManagedTest> tests = testRepository.search(status, type, blankToNull(search),
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        // One extra query per page (not per row) for the question counts, to keep this off the N+1 path.
        return tests.map(t -> mapper.toSummary(t,
                countQuestions(t.getId()),
                (int) assignmentRepository.countByTestIdAndActiveTrue(t.getId()),
                attemptRepository.countByTestId(t.getId())));
    }

    @Transactional(readOnly = true)
    public TestDetailResponse detail(Long testId) {
        ManagedTest test = loadWithTree(testId);
        return toDetail(test, true);
    }

    /** Preview is the same tree an admin can see, including answers - it exists to verify them. */
    @Transactional(readOnly = true)
    public TestDetailResponse preview(Long testId) {
        return detail(testId);
    }

    @Transactional
    public TestDetailResponse create(TestUpsertRequest request) {
        User admin = currentUserService.getCurrentUser();
        ManagedTest test = ManagedTest.builder()
                .name(request.name())
                .testType(request.testType())
                .status(TestStatus.DRAFT)
                .createdBy(admin)
                .build();
        apply(test, request);
        testRepository.save(test);
        return toDetail(test, true);
    }

    @Transactional
    public TestDetailResponse update(Long testId, TestUpsertRequest request) {
        ManagedTest test = loadWithTree(testId);
        guardEditable(test);
        apply(test, request);
        recalculateTotals(test);
        testRepository.save(test);
        return toDetail(test, true);
    }

    /**
     * Archive rather than delete: attempts, results and analytics all reference the test, and losing
     * them to a stray click is not recoverable.
     */
    @Transactional
    public void archive(Long testId) {
        ManagedTest test = load(testId);
        test.setStatus(TestStatus.ARCHIVED);
        test.setActive(false);
        test.setArchivedAt(Instant.now());
        testRepository.save(test);
        auditLogService.record(currentUserService.getCurrentUser(), "TEST_ARCHIVED", "ManagedTest", testId, test.getName());
    }

    @Transactional
    public TestDetailResponse duplicate(Long testId, String newName) {
        ManagedTest source = loadWithTree(testId);
        User admin = currentUserService.getCurrentUser();

        ManagedTest copy = ManagedTest.builder()
                .name(newName != null && !newName.isBlank() ? newName : source.getName() + " (Copy)")
                .testType(source.getTestType())
                .description(source.getDescription())
                .instructions(source.getInstructions())
                .organizationName(source.getOrganizationName())
                .organizationCode(source.getOrganizationCode())
                .batch(source.getBatch())
                .branch(source.getBranch())
                .graduationYear(source.getGraduationYear())
                .targetJobRole(source.getTargetJobRole())
                .difficulty(source.getDifficulty())
                .durationMinutes(source.getDurationMinutes())
                .passingPercentage(source.getPassingPercentage())
                .negativeMarkingEnabled(source.isNegativeMarkingEnabled())
                .defaultNegativeMarks(source.getDefaultNegativeMarks())
                .overallTimerEnabled(source.isOverallTimerEnabled())
                .sectionTimersEnabled(source.isSectionTimersEnabled())
                .attemptLimit(source.getAttemptLimit())
                .shuffleSections(source.isShuffleSections())
                .showResultToStudent(source.isShowResultToStudent())
                .proctored(source.isProctored())
                .fullscreenRequired(source.isFullscreenRequired())
                .webcamRequired(source.isWebcamRequired())
                .violationCountThreshold(source.getViolationCountThreshold())
                .status(TestStatus.DRAFT)   // a copy always starts as a draft, never live
                .createdBy(admin)
                .build();
        testRepository.save(copy);

        for (ManagedTestSection section : source.orderedSections()) {
            ManagedTestSection sectionCopy = ManagedTestSection.builder()
                    .test(copy)
                    .name(section.getName())
                    .sectionType(section.getSectionType())
                    .instructions(section.getInstructions())
                    .displayOrder(section.getDisplayOrder())
                    .questionCount(section.getQuestionCount())
                    .durationMinutes(section.getDurationMinutes())
                    .marksPerQuestion(section.getMarksPerQuestion())
                    .negativeMarks(section.getNegativeMarks())
                    .passingPercentage(section.getPassingPercentage())
                    .mandatory(section.isMandatory())
                    .randomizeQuestions(section.isRandomizeQuestions())
                    .randomizeOptions(section.isRandomizeOptions())
                    .allowBackNavigation(section.isAllowBackNavigation())
                    .selectionStrategy(section.getSelectionStrategy())
                    .selectionRules(new HashMap<>(section.getSelectionRules()))
                    .build();
            sectionRepository.save(sectionCopy);
            copy.getSections().add(sectionCopy);

            for (ManagedTestQuestion q : section.orderedQuestions()) {
                ManagedTestQuestion qCopy = ManagedTestQuestion.builder()
                        .section(sectionCopy)
                        .questionType(q.getQuestionType())
                        .origin(q.getOrigin())
                        .sourceType(q.getSourceType())
                        .sourceQuestionId(q.getSourceQuestionId())
                        .title(q.getTitle())
                        .difficulty(q.getDifficulty())
                        .topic(q.getTopic())
                        .subtopic(q.getSubtopic())
                        .marks(q.getMarks())
                        .negativeMarks(q.getNegativeMarks())
                        .estimatedTimeSeconds(q.getEstimatedTimeSeconds())
                        .displayOrder(q.getDisplayOrder())
                        .payload(new LinkedHashMap<>(q.getPayload()))
                        .build();
                questionRepository.save(qCopy);
                sectionCopy.getQuestions().add(qCopy);
            }
        }
        recalculateTotals(copy);
        testRepository.save(copy);
        auditLogService.record(admin, "TEST_DUPLICATED", "ManagedTest", copy.getId(),
                "from testId=" + testId + " -> " + copy.getName());
        return toDetail(copy, true);
    }

    @Transactional
    public TestDetailResponse publish(Long testId) {
        ManagedTest test = loadWithTree(testId);
        ValidationReport report = validationService.validate(test);
        if (!report.publishable()) {
            throw ApiException.badRequest("Test cannot be published: " + String.join(" ", report.errors()));
        }
        recalculateTotals(test);
        test.setStatus(derivedStatus(test, Instant.now()));
        test.setPublishedAt(Instant.now());
        testRepository.save(test);
        auditLogService.record(currentUserService.getCurrentUser(), "TEST_PUBLISHED", "ManagedTest", testId, test.getName());
        return toDetail(test, true);
    }

    @Transactional
    public TestDetailResponse unpublish(Long testId) {
        ManagedTest test = loadWithTree(testId);
        long attempts = attemptRepository.countByTestId(testId);
        if (attempts > 0) {
            // Attempts already exist; reverting to DRAFT would let an admin edit questions underneath
            // them. COMPLETED closes the test without rewriting history.
            test.setStatus(TestStatus.COMPLETED);
        } else {
            test.setStatus(TestStatus.DRAFT);
        }
        testRepository.save(test);
        auditLogService.record(currentUserService.getCurrentUser(), "TEST_UNPUBLISHED", "ManagedTest", testId, test.getName());
        return toDetail(test, true);
    }

    /**
     * Moves SCHEDULED -> ACTIVE -> COMPLETED as the clock passes each test's window. Called by the
     * student-facing listing and by the scheduled sweep, so status is never stale by more than a poll.
     */
    @Transactional
    public int refreshDerivedStatuses() {
        Instant now = Instant.now();
        List<ManagedTest> live = testRepository.findByStatusInAndActiveTrue(
                List.of(TestStatus.PUBLISHED, TestStatus.SCHEDULED, TestStatus.ACTIVE));
        int changed = 0;
        for (ManagedTest test : live) {
            TestStatus next = derivedStatus(test, now);
            if (next != test.getStatus()) {
                test.setStatus(next);
                testRepository.save(test);
                changed++;
            }
        }
        return changed;
    }

    private TestStatus derivedStatus(ManagedTest test, Instant now) {
        if (test.getStartsAt() != null && now.isBefore(test.getStartsAt())) return TestStatus.SCHEDULED;
        if (test.getEndsAt() != null && now.isAfter(test.getEndsAt())) return TestStatus.COMPLETED;
        if (test.getStartsAt() == null && test.getEndsAt() == null) return TestStatus.PUBLISHED;
        return TestStatus.ACTIVE;
    }

    // ------------------------------------------------------------------ sections

    @Transactional(readOnly = true)
    public List<SectionResponse> sections(Long testId) {
        return sectionRepository.findWithQuestionsByTestId(testId).stream()
                .map(s -> mapper.toSection(s, true)).toList();
    }

    @Transactional
    public SectionResponse addSection(Long testId, SectionUpsertRequest request) {
        ManagedTest test = loadWithTree(testId);
        guardEditable(test);
        int order = request.displayOrder() != null ? request.displayOrder() : test.getSections().size();
        ManagedTestSection section = ManagedTestSection.builder()
                .test(test)
                .name(request.name())
                .sectionType(request.sectionType())
                .displayOrder(order)
                .build();
        applySection(section, request);
        sectionRepository.save(section);
        test.getSections().add(section);
        recalculateTotals(test);
        testRepository.save(test);
        return mapper.toSection(section, true);
    }

    @Transactional
    public SectionResponse updateSection(Long testId, Long sectionId, SectionUpsertRequest request) {
        ManagedTestSection section = loadSection(testId, sectionId);
        guardEditable(section.getTest());
        section.setName(request.name());
        section.setSectionType(request.sectionType());
        if (request.displayOrder() != null) section.setDisplayOrder(request.displayOrder());
        applySection(section, request);
        sectionRepository.save(section);
        recalculateTotals(section.getTest());
        testRepository.save(section.getTest());
        return mapper.toSection(section, true);
    }

    @Transactional
    public void deleteSection(Long testId, Long sectionId) {
        ManagedTestSection section = loadSection(testId, sectionId);
        guardEditable(section.getTest());
        ManagedTest test = section.getTest();
        test.getSections().remove(section);
        sectionRepository.delete(section);
        // Close the gap so display orders stay 0..n-1 and drag-and-drop doesn't produce ties.
        List<ManagedTestSection> remaining = sectionRepository.findByTestIdOrderByDisplayOrderAsc(testId);
        for (int i = 0; i < remaining.size(); i++) remaining.get(i).setDisplayOrder(i);
        sectionRepository.saveAll(remaining);
        recalculateTotals(loadWithTree(testId));
    }

    @Transactional
    public void reorderSections(Long testId, List<Long> orderedIds) {
        List<ManagedTestSection> sections = sectionRepository.findByTestIdOrderByDisplayOrderAsc(testId);
        Map<Long, ManagedTestSection> byId = new HashMap<>();
        sections.forEach(s -> byId.put(s.getId(), s));
        int order = 0;
        for (Long id : orderedIds) {
            ManagedTestSection section = byId.get(id);
            if (section == null) throw ApiException.badRequest("Section " + id + " does not belong to this test.");
            section.setDisplayOrder(order++);
        }
        sectionRepository.saveAll(sections);
    }

    // ------------------------------------------------------------------ questions

    @Transactional
    public List<QuestionResponse> addBankQuestions(Long testId, Long sectionId, AddBankQuestionsRequest request) {
        ManagedTestSection section = loadSection(testId, sectionId);
        guardEditable(section.getTest());

        Set<Long> existing = new HashSet<>(questionRepository.findSourceIdsInTest(testId));
        List<QuestionResponse> added = new ArrayList<>();
        int order = section.getQuestions().size();

        for (Long sourceId : request.questionIds()) {
            if (existing.contains(sourceId)) continue;  // duplicate guard, silently skipped
            ManagedTestQuestion question = sourcingService.snapshotFromBank(
                    request.sourceType(), sourceId, section, request.marksOverride(), request.negativeMarksOverride());
            question.setDisplayOrder(order++);
            questionRepository.save(question);
            section.getQuestions().add(question);
            existing.add(sourceId);
            added.add(mapper.toQuestion(question, true));
        }
        syncSectionCount(section);
        recalculateTotals(section.getTest());
        testRepository.save(section.getTest());
        return added;
    }

    @Transactional
    public QuestionResponse addCustomQuestion(Long testId, Long sectionId, CustomQuestionRequest request) {
        ManagedTestSection section = loadSection(testId, sectionId);
        guardEditable(section.getTest());

        Long bankId = Boolean.TRUE.equals(request.saveToQuestionBank())
                ? sourcingService.publishCustomQuestionToBank(request)
                : null;

        ManagedTestQuestion question = ManagedTestQuestion.builder()
                .section(section)
                .questionType(request.questionType())
                .origin(QuestionOrigin.CUSTOM)
                // Even when it was also written to the bank, the in-test copy stays CUSTOM: the
                // snapshot is authoritative here and must not be re-synced from the bank later.
                .sourceType(null)
                .sourceQuestionId(bankId)
                .title(request.title())
                .difficulty(request.difficulty())
                .topic(request.topic())
                .subtopic(request.subtopic())
                .marks(request.marks() != null ? request.marks() : section.getMarksPerQuestion())
                .negativeMarks(request.negativeMarks() != null ? request.negativeMarks() : section.getNegativeMarks())
                .estimatedTimeSeconds(request.estimatedTimeSeconds() != null ? request.estimatedTimeSeconds() : 60)
                .displayOrder(request.displayOrder() != null ? request.displayOrder() : section.getQuestions().size())
                .payload(new LinkedHashMap<>(request.payload()))
                .build();
        questionRepository.save(question);
        section.getQuestions().add(question);
        syncSectionCount(section);
        recalculateTotals(section.getTest());
        testRepository.save(section.getTest());
        return mapper.toQuestion(question, true);
    }

    @Transactional
    public QuestionResponse updateQuestion(Long testId, Long questionId, CustomQuestionRequest request) {
        ManagedTestQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> ApiException.notFound("Question not found"));
        if (!question.getSection().getTest().getId().equals(testId))
            throw ApiException.badRequest("Question does not belong to this test.");
        guardEditable(question.getSection().getTest());

        question.setQuestionType(request.questionType());
        question.setTitle(request.title());
        question.setDifficulty(request.difficulty());
        question.setTopic(request.topic());
        question.setSubtopic(request.subtopic());
        if (request.marks() != null) question.setMarks(request.marks());
        if (request.negativeMarks() != null) question.setNegativeMarks(request.negativeMarks());
        if (request.estimatedTimeSeconds() != null) question.setEstimatedTimeSeconds(request.estimatedTimeSeconds());
        question.setPayload(new LinkedHashMap<>(request.payload()));
        // The bank row this was copied from is deliberately left untouched.
        questionRepository.save(question);
        recalculateTotals(question.getSection().getTest());
        return mapper.toQuestion(question, true);
    }

    @Transactional
    public void removeQuestion(Long testId, Long questionId) {
        ManagedTestQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> ApiException.notFound("Question not found"));
        if (!question.getSection().getTest().getId().equals(testId))
            throw ApiException.badRequest("Question does not belong to this test.");
        guardEditable(question.getSection().getTest());
        ManagedTestSection section = question.getSection();
        section.getQuestions().remove(question);
        questionRepository.delete(question);
        List<ManagedTestQuestion> remaining = questionRepository.findBySectionIdOrderByDisplayOrderAsc(section.getId());
        for (int i = 0; i < remaining.size(); i++) remaining.get(i).setDisplayOrder(i);
        questionRepository.saveAll(remaining);
        syncSectionCount(section);
        recalculateTotals(section.getTest());
    }

    @Transactional
    public void reorderQuestions(Long testId, Long sectionId, List<Long> orderedIds) {
        ManagedTestSection section = loadSection(testId, sectionId);
        Map<Long, ManagedTestQuestion> byId = new HashMap<>();
        section.getQuestions().forEach(q -> byId.put(q.getId(), q));
        int order = 0;
        for (Long id : orderedIds) {
            ManagedTestQuestion q = byId.get(id);
            if (q == null) throw ApiException.badRequest("Question " + id + " is not in this section.");
            q.setDisplayOrder(order++);
        }
        questionRepository.saveAll(byId.values());
    }

    @Transactional
    public AutoFillResponse autoFill(Long testId, Long sectionId, AutoFillRequest request) {
        ManagedTestSection section = loadSection(testId, sectionId);
        guardEditable(section.getTest());

        if (!Boolean.TRUE.equals(request.keepExisting())) {
            List<ManagedTestQuestion> generated = section.getQuestions().stream()
                    .filter(q -> q.getOrigin() == QuestionOrigin.QUESTION_BANK)
                    .toList();
            // Only the previously auto-added bank questions are cleared; manual picks survive, which
            // is what makes re-running the rules on a HYBRID section safe.
            generated.forEach(q -> section.getQuestions().remove(q));
            questionRepository.deleteAll(generated);
        }

        Set<Long> exclude = new HashSet<>(questionRepository.findSourceIdsInTest(testId));
        TestQuestionSourcingService.AutoFillResult result = sourcingService.autoSelect(section, request, exclude);

        int order = section.getQuestions().size();
        for (ManagedTestQuestion q : result.questions()) {
            q.setDisplayOrder(order++);
            questionRepository.save(q);
            section.getQuestions().add(q);
        }
        syncSectionCount(section);
        recalculateTotals(section.getTest());
        testRepository.save(section.getTest());

        int requested = request.count() != null ? request.count() : section.getQuestionCount();
        return new AutoFillResponse(requested, result.added(), result.shortfall(), result.notes());
    }

    // ------------------------------------------------------------------ assignment

    @Transactional
    public List<AssignmentResponse> assign(Long testId, List<Long> studentIds, String reason) {
        ManagedTest test = load(testId);
        User admin = currentUserService.getCurrentUser();
        List<AssignmentResponse> out = new ArrayList<>();
        for (Long studentId : studentIds) {
            if (assignmentRepository.existsByTestIdAndStudentIdAndActiveTrue(testId, studentId)) continue;
            User student = userRepository.findById(studentId)
                    .orElseThrow(() -> ApiException.notFound("Student " + studentId + " not found"));
            ManagedTestAssignment assignment = assignmentRepository.save(ManagedTestAssignment.builder()
                    .test(test).student(student).assignedBy(admin).reason(reason).build());
            auditLogService.record(admin, "ACCESS_GRANTED", "ManagedTestAssignment", assignment.getId(),
                    "test=" + testId + " student=" + studentId + (reason == null ? "" : " reason=" + reason));
            out.add(new AssignmentResponse(assignment.getId(), student.getId(), student.getFullName(),
                    student.getEmail(), assignment.getAssignedAt(), null, null,
                    true, null, null, assignment.getReason()));
        }
        return out;
    }

    /** Revoke is unconditional and always succeeds - it never blocks on, deletes, or otherwise
     *  touches an in-progress attempt (spec section 41: "DO NOT DELETE THE ATTEMPT"). hasActiveAttempt
     *  on the response is purely informational, so the admin UI can show a warning rather than the
     *  admin having to separately go check. revokedAt/revokedBy/reason are now recorded on every
     *  row this deactivates - previously unassign() only flipped active=false with no record of
     *  who did it, when, or why. */
    @Transactional
    public UnassignResponse unassign(Long testId, Long studentId, String reason) {
        User admin = currentUserService.getCurrentUser();
        Instant now = Instant.now();
        boolean revokedAny = false;
        for (ManagedTestAssignment a : assignmentRepository.findByStudentIdAndActiveTrue(studentId)) {
            if (!a.getTest().getId().equals(testId)) continue;
            a.setActive(false);
            a.setRevokedAt(now);
            a.setRevokedBy(admin);
            a.setReason(reason);
            assignmentRepository.save(a);
            auditLogService.record(admin, "ACCESS_REVOKED", "ManagedTestAssignment", a.getId(),
                    "test=" + testId + " student=" + studentId + (reason == null ? "" : " reason=" + reason));
            revokedAny = true;
        }
        boolean hasActiveAttempt = attemptRepository.findByTestIdAndStudentId(testId, studentId).stream()
                .anyMatch(at -> at.getStatus() == AttemptStatus.IN_PROGRESS);
        return new UnassignResponse(revokedAny, hasActiveAttempt);
    }

    @Transactional(readOnly = true)
    public Page<AssignmentResponse> assignments(Long testId, boolean includeRevoked, int page, int size) {
        Page<ManagedTestAssignment> source = includeRevoked
                ? assignmentRepository.findByTestId(testId, PageRequest.of(page, Math.min(size, 100)))
                : assignmentRepository.findByTestIdAndActiveTrue(testId, PageRequest.of(page, Math.min(size, 100)));
        return source.map(a -> {
                    List<ManagedTestAttempt> attempts = attemptRepository.findByTestIdAndStudentId(testId, a.getStudent().getId());
                    String status = attempts.isEmpty() ? "NOT_STARTED" : attempts.get(attempts.size() - 1).getStatus().name();
                    Double best = attempts.stream().map(ManagedTestAttempt::getPercentage)
                            .max(Double::compareTo).orElse(null);
                    return new AssignmentResponse(a.getId(), a.getStudent().getId(), a.getStudent().getFullName(),
                            a.getStudent().getEmail(), a.getAssignedAt(), status, best,
                            a.isActive(), a.getRevokedAt(),
                            a.getRevokedBy() == null ? null : a.getRevokedBy().getFullName(),
                            a.getReason());
                });
    }

    // ------------------------------------------------------------------ helpers

    private void apply(ManagedTest test, TestUpsertRequest r) {
        test.setName(r.name());
        test.setTestType(r.testType());
        test.setDescription(r.description());
        test.setInstructions(r.instructions());
        test.setOrganizationName(r.organizationName());
        test.setOrganizationCode(r.organizationCode());
        test.setBatch(r.batch());
        test.setBranch(r.branch());
        test.setGraduationYear(r.graduationYear());
        test.setDifficulty(r.difficulty());
        if (r.durationMinutes() != null) test.setDurationMinutes(r.durationMinutes());
        if (r.passingPercentage() != null) test.setPassingPercentage(r.passingPercentage());
        if (r.negativeMarkingEnabled() != null) test.setNegativeMarkingEnabled(r.negativeMarkingEnabled());
        if (r.defaultNegativeMarks() != null) test.setDefaultNegativeMarks(r.defaultNegativeMarks());
        if (r.overallTimerEnabled() != null) test.setOverallTimerEnabled(r.overallTimerEnabled());
        if (r.sectionTimersEnabled() != null) test.setSectionTimersEnabled(r.sectionTimersEnabled());
        if (r.attemptLimit() != null) test.setAttemptLimit(r.attemptLimit());
        if (r.shuffleSections() != null) test.setShuffleSections(r.shuffleSections());
        if (r.showResultToStudent() != null) test.setShowResultToStudent(r.showResultToStudent());
        test.setStartsAt(r.startsAt());
        test.setEndsAt(r.endsAt());
        if (r.proctored() != null) test.setProctored(r.proctored());
        if (r.fullscreenRequired() != null) test.setFullscreenRequired(r.fullscreenRequired());
        if (r.webcamRequired() != null) test.setWebcamRequired(r.webcamRequired());
        if (r.violationCountThreshold() != null) test.setViolationCountThreshold(r.violationCountThreshold());
        if (r.targetJobRoleId() != null) {
            JobRole role = jobRoleRepository.findById(r.targetJobRoleId())
                    .orElseThrow(() -> ApiException.notFound("Job role not found"));
            test.setTargetJobRole(role);
        } else {
            test.setTargetJobRole(null);
        }
    }

    private void applySection(ManagedTestSection section, SectionUpsertRequest r) {
        section.setInstructions(r.instructions());
        if (r.questionCount() != null) section.setQuestionCount(r.questionCount());
        if (r.durationMinutes() != null) section.setDurationMinutes(r.durationMinutes());
        if (r.marksPerQuestion() != null) section.setMarksPerQuestion(r.marksPerQuestion());
        if (r.negativeMarks() != null) section.setNegativeMarks(r.negativeMarks());
        section.setPassingPercentage(r.passingPercentage());
        if (r.mandatory() != null) section.setMandatory(r.mandatory());
        if (r.randomizeQuestions() != null) section.setRandomizeQuestions(r.randomizeQuestions());
        if (r.randomizeOptions() != null) section.setRandomizeOptions(r.randomizeOptions());
        if (r.allowBackNavigation() != null) section.setAllowBackNavigation(r.allowBackNavigation());
        if (r.selectionStrategy() != null) section.setSelectionStrategy(r.selectionStrategy());
        if (r.selectionRules() != null) section.setSelectionRules(new HashMap<>(r.selectionRules()));
    }

    /** Keeps the section's declared question count honest for MANUAL sections. */
    private void syncSectionCount(ManagedTestSection section) {
        if (section.getSelectionStrategy() == SelectionStrategy.MANUAL) {
            section.setQuestionCount(section.getQuestions().size());
        }
        sectionRepository.save(section);
    }

    private void recalculateTotals(ManagedTest test) {
        double total = 0d;
        for (ManagedTestSection section : test.getSections()) total += section.attachedMarks();
        test.setTotalMarks(total);
    }

    /**
     * Published tests with attempts against them are frozen. Letting an admin change questions or
     * marks underneath a live attempt would invalidate every result already recorded.
     */
    private void guardEditable(ManagedTest test) {
        if (test.getStatus() == TestStatus.ARCHIVED)
            throw ApiException.badRequest("Archived tests cannot be edited.");
        long attempts = attemptRepository.countByTestId(test.getId());
        if (attempts > 0)
            throw ApiException.conflict("This test already has attempts and can no longer be edited. "
                    + "Duplicate it to create an editable copy.");
    }

    private ManagedTest load(Long id) {
        return testRepository.findById(id).orElseThrow(() -> ApiException.notFound("Test " + id + " not found"));
    }

    private ManagedTest loadWithTree(Long id) {
        ManagedTest test = testRepository.findWithSectionsById(id)
                .orElseThrow(() -> ApiException.notFound("Test " + id + " not found"));
        test.getSections().forEach(s -> s.getQuestions().size()); // initialize within the transaction
        return test;
    }

    private ManagedTestSection loadSection(Long testId, Long sectionId) {
        ManagedTestSection section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> ApiException.notFound("Section " + sectionId + " not found"));
        if (!section.getTest().getId().equals(testId))
            throw ApiException.badRequest("Section does not belong to test " + testId + ".");
        return section;
    }

    private int countQuestions(Long testId) {
        return questionRepository.findBySectionTestId(testId).size();
    }

    private TestDetailResponse toDetail(ManagedTest test, boolean includeSolutions) {
        List<SectionResponse> sections = test.orderedSections().stream()
                .map(s -> mapper.toSection(s, includeSolutions)).toList();
        int questionCount = sections.stream().mapToInt(SectionResponse::attachedQuestionCount).sum();
        long attempts = attemptRepository.countByTestId(test.getId());
        return new TestDetailResponse(
                mapper.toSummary(test, questionCount,
                        (int) assignmentRepository.countByTestIdAndActiveTrue(test.getId()), attempts),
                test.getDescription(), test.getInstructions(),
                test.getTargetJobRole() != null ? test.getTargetJobRole().getId() : null,
                test.getTargetJobRole() != null ? test.getTargetJobRole().getTitle() : null,
                test.isNegativeMarkingEnabled(), test.getDefaultNegativeMarks(),
                test.isOverallTimerEnabled(), test.isSectionTimersEnabled(), test.getAttemptLimit(),
                test.isShuffleSections(), test.isShowResultToStudent(), test.isProctored(),
                test.isFullscreenRequired(), test.isWebcamRequired(), test.getViolationCountThreshold(),
                sections, validationService.validate(test)
        );
    }

    private String blankToNull(String s) { return s == null || s.isBlank() ? null : s; }
}