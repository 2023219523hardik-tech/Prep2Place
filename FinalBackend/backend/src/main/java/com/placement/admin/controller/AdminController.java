package com.placement.controller;

import com.placement.dto.AdminDtos;
import com.placement.dto.AdminDtos.*;
import com.placement.dto.ProfileDtos.ProfileResponse;
import com.placement.dto.ReadinessDtos.ReadinessResponse;
import com.placement.dto.ReadinessDtos.SkillGapResponse;
import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.entity.AttemptStatus;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.InterviewSessionRepository;
import com.placement.repository.UserRepository;
import com.placement.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final UserRepository userRepository;
    private final StudentProfileService studentProfileService;
    private final ReadinessService readinessService;
    private final SkillGapService skillGapService;
    private final QuestionService questionService;
    private final JobRoleService jobRoleService;
    private final AptitudeService aptitudeService;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final InterviewSessionRepository interviewSessionRepository;
    private final InterviewService interviewService;

    @GetMapping("/dashboard")
    public AdminStatsResponse dashboard() { return adminService.getStats(); }

    @GetMapping("/dashboard/statistics")
    public AdminStatsResponse statistics() { return adminService.getStats(); }

    @GetMapping("/dashboard/performance")
    public AdminStatsResponse performance() { return adminService.getStats(); }

    @GetMapping("/dashboard/placement-readiness")
    public AdminStatsResponse placementReadiness() { return adminService.getStats(); }

    @GetMapping("/interviews/flagged")
    public List<FlaggedInterviewResponse> flaggedInterviews() { return adminService.getFlaggedInterviews(); }

    @GetMapping("/students")
    public AdminDtos.PageResponse<UserSummary> students(@RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size,
                                                       @RequestParam(required = false) String search) {
        Page<User> result = adminService.listStudents(page, size, search);
        List<UserSummary> content = result.getContent().stream()
                .map(u -> new UserSummary(u.getId(), u.getEmail(), u.getFullName(), u.isActive(), u.isPremium()))
                .toList();
        return new AdminDtos.PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isFirst(),
                result.isLast()
        );
    }

    @GetMapping("/students/{studentId}")
    public ProfileResponse studentDetail(@PathVariable Long studentId) { return studentProfileService.getProfileByStudentId(studentId); }

    @PutMapping("/students/{studentId}")
    public UserSummary updateStudent(@PathVariable Long studentId, @RequestBody com.placement.dto.AuthDtos.UpdateUserRequest request) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        if (request.fullName() != null) user.setFullName(request.fullName());
        userRepository.save(user);
        return new UserSummary(user.getId(), user.getEmail(), user.getFullName(), user.isActive(), user.isPremium());
    }

    @PatchMapping("/students/{studentId}/status")
    public java.util.Map<String, String> setStatus(@PathVariable Long studentId, @RequestBody UpdateStudentStatusRequest request) {
        adminService.setStudentActive(studentId, Boolean.TRUE.equals(request.active()));
        return java.util.Map.of("message", "Status updated");
    }

    /** Section 5 (Company Vault): manual premium grant/revoke until real billing exists - see the
     *  comment on User.premium. Body shape intentionally mirrors /status above ({"active": bool}
     *  there, {"premium": bool} here) for frontend consistency. */
    @PatchMapping("/students/{studentId}/premium")
    public UserSummary setPremium(@PathVariable Long studentId, @RequestBody java.util.Map<String, Boolean> body) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        user.setPremium(Boolean.TRUE.equals(body.get("premium")));
        userRepository.save(user);
        return new UserSummary(user.getId(), user.getEmail(), user.getFullName(), user.isActive(), user.isPremium());
    }

    @DeleteMapping("/students/{studentId}")
    public java.util.Map<String, String> deleteStudent(@PathVariable Long studentId) {
        adminService.setStudentActive(studentId, false);
        return java.util.Map.of("message", "Student deactivated");
    }

    @GetMapping("/students/{studentId}/readiness")
    public ReadinessResponse studentReadiness(@PathVariable Long studentId) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        return readinessService.analyze(user);
    }

    @GetMapping("/students/{studentId}/performance")
    public ReadinessResponse studentPerformance(@PathVariable Long studentId) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        return readinessService.analyze(user);
    }

    @GetMapping("/students/{studentId}/skill-gaps")
    public SkillGapResponse studentSkillGaps(@PathVariable Long studentId) {
        User user = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        return skillGapService.analyze(user, null);
    }

    @GetMapping("/questions")
    public List<Question> questions() { return questionService.list(); }

    @PostMapping("/questions")
    public Question createQuestion(@RequestBody CreateQuestionRequest request) { return adminService.createQuestion(request); }

    @GetMapping("/questions/{questionId}")
    public Question questionDetail(@PathVariable Long questionId) { return questionService.get(questionId); }

    @PutMapping("/questions/{questionId}")
    public Question updateQuestion(@PathVariable Long questionId, @RequestBody CreateQuestionRequest request) {
        return adminService.updateQuestion(questionId, request);
    }

    @DeleteMapping("/questions/{questionId}")
    public java.util.Map<String, String> deleteQuestion(@PathVariable Long questionId) {
        adminService.deleteQuestion(questionId);
        return java.util.Map.of("message", "Question deleted");
    }

    @PatchMapping("/questions/{questionId}/status")
    public Question setQuestionStatus(@PathVariable Long questionId, @RequestBody java.util.Map<String, Boolean> body) {
        return adminService.setQuestionStatus(questionId, Boolean.TRUE.equals(body.get("published")));
    }

    @PostMapping("/questions/bulk-upload")
    public List<Question> bulkUpload(@RequestBody BulkQuestionUploadRequest request) { return adminService.bulkCreateQuestions(request); }

    // ---- Aptitude/quant/reasoning question bank (JSON-seeded, scalable) ----

    @GetMapping("/aptitude-questions")
    public List<com.placement.entity.AptitudeQuestion> aptitudeQuestions() {
        return aptitudeService.listQuestions();
    }

    @PostMapping("/aptitude-questions/bulk-upload")
    public java.util.Map<String, Object> bulkUploadAptitudeQuestions(
            @RequestBody List<com.placement.config.AptitudeQuestionSeedLoader.AptitudeQuestionSeed> questions) {
        return adminService.bulkCreateAptitudeQuestions(questions);
    }

    // Single-question lifecycle - previously missing entirely (see AdminService's comment above
    // its aptitude CRUD block for why). Mirrors the Technical MCQ admin CRUD in
    // QuestionBankAdminController: single POST, full-overwrite PUT, soft-delete-by-default DELETE,
    // explicit reactivate, and a separate explicit permanent-delete path.

    @PostMapping("/aptitude-questions")
    public com.placement.entity.AptitudeQuestion createAptitudeQuestion(@RequestBody AptitudeQuestionUpsertRequest request) {
        return adminService.createAptitudeQuestion(request);
    }

    @PutMapping("/aptitude-questions/{questionId}")
    public com.placement.entity.AptitudeQuestion updateAptitudeQuestion(@PathVariable Long questionId,
                                                                         @RequestBody AptitudeQuestionUpsertRequest request) {
        return adminService.updateAptitudeQuestion(questionId, request);
    }

    /** Soft delete by default - see AdminService.archiveAptitudeQuestion. */
    @DeleteMapping("/aptitude-questions/{questionId}")
    public com.placement.entity.AptitudeQuestion archiveAptitudeQuestion(@PathVariable Long questionId) {
        return adminService.archiveAptitudeQuestion(questionId);
    }

    @PatchMapping("/aptitude-questions/{questionId}/reactivate")
    public com.placement.entity.AptitudeQuestion reactivateAptitudeQuestion(@PathVariable Long questionId) {
        return adminService.reactivateAptitudeQuestion(questionId);
    }

    /** Genuinely destructive; refused with a clear message when the question has attempts - see
     *  AdminService.deleteAptitudeQuestionPermanently. Deliberately a distinct path from the DELETE
     *  mapping above, same reasoning as the Technical MCQ admin CRUD's "/permanent" endpoint. */
    @DeleteMapping("/aptitude-questions/{questionId}/permanent")
    public java.util.Map<String, String> deleteAptitudeQuestionPermanently(@PathVariable Long questionId) {
        adminService.deleteAptitudeQuestionPermanently(questionId);
        return java.util.Map.of("message", "Aptitude question permanently deleted");
    }

    @PostMapping("/roles")
    public JobRole createRole(@RequestBody CreateJobRoleRequest request) { return adminService.createRole(request); }

    @GetMapping("/roles")
    public List<JobRole> roles() { return jobRoleService.listRoles(); }

    @PutMapping("/config/scoring-weights")
    public ScoreWeightConfig updateWeights(@RequestBody ScoreWeightConfigRequest request) { return adminService.updateWeights(request); }

    // ---- Live Monitoring ----

    public record LiveAttemptsWrapper(List<LiveAttempt> attempts, LiveSummary summary) {}
    public record LiveAttempt(Long attemptId, Long userId, String userName, String userEmail,
                              String status, String type, Integer integrityScore,
                              String startedAt, String lastSeenAt) {}
    public record LiveSummary(int completedToday, int terminatedToday) {}

    @GetMapping("/live/attempts")
    public LiveAttemptsWrapper getLiveAttempts() {
        List<LiveAttempt> attempts = new ArrayList<>();
        int completedToday = 0;
        int terminatedToday = 0;
        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();

        try {
            List<AssessmentAttempt> allAttempts = assessmentAttemptRepository.findAll();
            for (AssessmentAttempt a : allAttempts) {
                String status = toStatusString(a.getStatus());
                User u = a.getCandidate();
                String userName = u != null ? u.getFullName() : "Unknown";
                String userEmail = u != null ? u.getEmail() : "";
                Long userId = u != null ? u.getId() : null;
                String startedAt = a.getStartedAt() != null ? a.getStartedAt().toString() : null;
                String lastSeen = a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : startedAt;
                Integer integrity = a.getIntegrityScore();

                boolean completed = a.getStatus() == AttemptStatus.SUBMITTED
                        || a.getStatus() == AttemptStatus.AUTO_SUBMITTED
                        || a.getStatus() == AttemptStatus.AUTO_SUBMITTED_TAB_SWITCH;
                if (completed) {
                    Instant ref = a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getUpdatedAt();
                    if (ref != null) {
                        LocalDate d = LocalDate.ofInstant(ref, zone);
                        if (today.equals(d)) completedToday++;
                    }
                }
                boolean terminated = a.getStatus() == AttemptStatus.TERMINATED
                        || a.getStatus() == AttemptStatus.TAB_SWITCH_TERMINATED
                        || a.getStatus() == AttemptStatus.LOCKED;
                if (terminated) {
                    if (a.getUpdatedAt() != null) {
                        LocalDate upd = LocalDate.ofInstant(a.getUpdatedAt(), zone);
                        if (today.equals(upd)) terminatedToday++;
                    }
                }

                attempts.add(new LiveAttempt(
                        a.getId(), userId, userName, userEmail,
                        status, "mock", integrity, startedAt, lastSeen
                ));
            }
        } catch (Exception ignored) {}

        try {
            List<InterviewSession> sessions = interviewSessionRepository.findAll();
            for (InterviewSession s : sessions) {
                String status = toInterviewStatusString(s.getStatus());
                User u = s.getStudent();
                String userName = u != null ? u.getFullName() : "Unknown";
                String userEmail = u != null ? u.getEmail() : "";
                Long userId = u != null ? u.getId() : null;
                String startedAt = s.getCreatedAt() != null ? s.getCreatedAt().toString() : null;
                LocalDateTime lastRef = s.getCompletedAt() != null ? s.getCompletedAt()
                        : (s.getTerminatedAt() != null ? s.getTerminatedAt() : s.getCreatedAt());
                String lastSeen = lastRef != null ? lastRef.toString() : startedAt;
                int integrity = s.getIntegrityScore() != null ? s.getIntegrityScore().intValue() : 100;

                if (s.getStatus() == InterviewStatus.COMPLETED
                        || s.getStatus() == InterviewStatus.REPORT_READY
                        || s.getStatus() == InterviewStatus.SUBMITTED) {
                    LocalDateTime ref = s.getCompletedAt() != null ? s.getCompletedAt() : s.getCreatedAt();
                    if (ref != null && today.equals(ref.toLocalDate())) completedToday++;
                }
                if (s.getStatus() == InterviewStatus.TERMINATED_VIOLATION
                        || s.getStatus() == InterviewStatus.CANCELLED
                        || s.getStatus() == InterviewStatus.EXITED) {
                    LocalDateTime ref = s.getTerminatedAt() != null ? s.getTerminatedAt() : s.getCreatedAt();
                    if (ref != null && today.equals(ref.toLocalDate())) terminatedToday++;
                }

                attempts.add(new LiveAttempt(
                        s.getId(), userId, userName, userEmail,
                        status, "interview", integrity, startedAt, lastSeen
                ));
            }
        } catch (Exception ignored) {}

        return new LiveAttemptsWrapper(attempts, new LiveSummary(completedToday, terminatedToday));
    }

    @PostMapping("/live/attempts/{id}/terminate")
    public Map<String, String> terminateAttempt(@PathVariable Long id) {
        try {
            AssessmentAttempt attempt = assessmentAttemptRepository.findById(id).orElse(null);
            if (attempt != null) {
                attempt.setStatus(AttemptStatus.TERMINATED);
                assessmentAttemptRepository.save(attempt);
                return Map.of("message", "Attempt terminated");
            }
        } catch (Exception ignored) {}
        try {
            InterviewSession session = interviewSessionRepository.findById(id).orElse(null);
            if (session != null) {
                session.setStatus(InterviewStatus.TERMINATED_VIOLATION);
                session.setTerminatedAt(LocalDateTime.now());
                interviewSessionRepository.save(session);
                interviewService.finalizePartialScores(id);
                return Map.of("message", "Interview session terminated");
            }
        } catch (Exception ignored) {}
        return Map.of("message", "No matching attempt or session found for id " + id);
    }

    private static String toStatusString(AttemptStatus status) {
        if (status == null) return "UNKNOWN";
        return switch (status) {
            case IN_PROGRESS -> "IN_PROGRESS";
            case SUBMITTED, AUTO_SUBMITTED, AUTO_SUBMITTED_TAB_SWITCH -> "COMPLETED";
            case TERMINATED, TAB_SWITCH_TERMINATED, LOCKED -> "TERMINATED";
            case NOT_STARTED, PAUSED -> "QUEUED";
            default -> status.name();
        };
    }

    private static String toInterviewStatusString(InterviewStatus status) {
        if (status == null) return "UNKNOWN";
        return switch (status) {
            case IN_PROGRESS -> "IN_PROGRESS";
            case COMPLETED, SUBMITTED, REPORT_GENERATING, REPORT_READY -> "COMPLETED";
            case TERMINATED_VIOLATION, CANCELLED, EXITED -> "TERMINATED";
            case CREATED, READY, PAUSED, RESUMABLE -> "QUEUED";
            default -> status.name();
        };
    }

    public record UserSummary(Long id, String email, String fullName, boolean active, boolean premium) {}
}