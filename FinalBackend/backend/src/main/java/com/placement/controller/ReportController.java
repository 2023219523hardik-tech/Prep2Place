package com.placement.controller;

import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.report.ReportDtos.AttemptReport;
import com.placement.assessment.report.ReportingService;
import com.placement.dto.InterviewDtos.InterviewReportResponse;
import com.placement.entity.InterviewSession;
import com.placement.entity.InterviewStatus;
import com.placement.entity.ProctoringEvent;
import com.placement.entity.Role;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.repository.InterviewSessionRepository;
import com.placement.repository.ProctoringEventRepository;
import com.placement.repository.UserRepository;
import com.placement.service.CurrentUserService;
import com.placement.service.InterviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final UserRepository userRepository;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final InterviewSessionRepository interviewSessionRepository;
    private final ProctoringEventRepository proctoringEventRepository;
    private final ReportingService reportingService;
    private final InterviewService interviewService;
    private final com.placement.service.InterviewReportService interviewReportService;
    private final CurrentUserService currentUserService;

    public record SummaryResp(
            long totalUsers,
            long totalAssessments,
            double avgMockScore,
            double avgInterviewRating,
            long incidents24h
    ) {}

    public record MockRow(
            Long reportId,
            Long attemptId,
            String userName,
            String userEmail,
            Double score,
            Instant completedAt,
            String verdict
    ) {}

    public record InterviewRow(
            Long reportId,
            Long sessionId,
            String userName,
            String userEmail,
            Double overallRating,
            Integer wpm,
            String verdict,
            Instant completedAt
    ) {}

    public record ProctoringIncidentRow(
            Long id,
            String sessionId,
            String type,
            String details,
            Instant createdAt,
            String userEmail
    ) {}

    public record LiveAttemptsWrapper(List<LiveAttempt> attempts, LiveSummary summary) {}
    public record LiveAttempt(Long attemptId, Long userId, String userName, String userEmail,
                               String status, String type, Integer integrityScore,
                               String startedAt, String lastSeenAt) {}
    public record LiveSummary(int completedToday, int terminatedToday) {}

    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public SummaryResp getSummary() {
        long totalUsers;
        long totalAssessments;
        double avgMockScore = 0.0;
        double avgInterviewRating = 0.0;
        long incidents24h = 0;

        try {
            totalUsers = userRepository.count();
        } catch (Exception e) {
            totalUsers = 0L;
        }

        try {
            List<AssessmentAttempt> allAttempts = assessmentAttemptRepository.findAll();
            totalAssessments = allAttempts.size();
            if (!allAttempts.isEmpty()) {
                OptionalDouble avg = allAttempts.stream()
                        .filter(a -> a.getMaxPossibleScore() > 0)
                        .mapToDouble(a -> (a.getRawScore() / a.getMaxPossibleScore()) * 100.0)
                        .average();
                avgMockScore = Math.round(avg.orElse(0.0) * 100.0) / 100.0;
            }
        } catch (Exception e) {
            totalAssessments = 0L;
        }

        try {
            List<InterviewSession> sessions = interviewSessionRepository.findAll();
            OptionalDouble avgRating = sessions.stream()
                    .filter(s -> s.getOverallScore() != null)
                    .mapToDouble(InterviewSession::getOverallScore)
                    .average();
            avgInterviewRating = Math.round(avgRating.orElse(0.0) * 100.0) / 100.0;
        } catch (Exception e) {
            avgInterviewRating = 0.0;
        }

        try {
            LocalDateTime cutoff24h = LocalDateTime.now().minusHours(24);
            List<ProctoringEvent> events = proctoringEventRepository.findAll();
            incidents24h = events.stream()
                    .filter(e -> e.getOccurredAt() != null && e.getOccurredAt().isAfter(cutoff24h))
                    .count();
        } catch (Exception e) {
            incidents24h = 0L;
        }

        return new SummaryResp(totalUsers, totalAssessments, avgMockScore, avgInterviewRating, incidents24h);
    }

    @GetMapping("/mocktests")
    @PreAuthorize("hasAnyRole('ADMIN', 'STUDENT')")
    public Page<MockRow> getMockTestReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) Long userId) {

        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.STUDENT) {
            userId = current.getId();
        }

        List<MockRow> rows = new ArrayList<>();
        try {
            List<AssessmentAttempt> attempts;
            if (userId != null) {
                attempts = assessmentAttemptRepository.findByCandidateIdOrderByCreatedAtDesc(userId);
            } else {
                attempts = assessmentAttemptRepository.findAll();
            }

            Map<Long, User> userCache = new HashMap<>();

            for (AssessmentAttempt a : attempts) {
                Long candidateId = a.getCandidate() != null ? a.getCandidate().getId() : null;
                String userName = "Unknown";
                String userEmail = "unknown";
                if (candidateId != null) {
                    User u = userCache.computeIfAbsent(candidateId, id ->
                            userRepository.findById(id).orElse(null));
                    if (u != null) {
                        userName = u.getFullName();
                        userEmail = u.getEmail();
                    }
                }

                double scorePct = a.getMaxPossibleScore() > 0
                        ? Math.round((a.getRawScore() / a.getMaxPossibleScore()) * 10000.0) / 100.0
                        : 0.0;

                Instant completedAt = a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getUpdatedAt();
                String verdict = determineMockVerdict(a, scorePct);

                rows.add(new MockRow(a.getId(), a.getId(), userName, userEmail, scorePct, completedAt, verdict));
            }
        } catch (Exception e) {
            // Fall through with empty list
        }

        Pageable pageable = PageRequest.of(page, size);
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), rows.size());
        List<MockRow> pageContent = start > rows.size() ? List.of() : rows.subList(start, end);
        return new PageImpl<>(pageContent, pageable, rows.size());
    }

    @GetMapping("/interviews")
    @PreAuthorize("hasAnyRole('ADMIN', 'STUDENT')")
    public Page<InterviewRow> getInterviewReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) Long userId) {

        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.STUDENT) {
            userId = current.getId();
        }

        List<InterviewRow> rows = new ArrayList<>();
        try {
            List<InterviewSession> sessions;
            if (userId != null) {
                sessions = interviewSessionRepository.findByStudentIdOrderByCreatedAtDesc(userId);
            } else {
                sessions = interviewSessionRepository.findAll();
            }

            for (InterviewSession s : sessions) {
                String userName = s.getStudent() != null ? s.getStudent().getFullName() : "Unknown";
                String userEmail = s.getStudent() != null ? s.getStudent().getEmail() : "unknown";
                Double overallRating = s.getOverallScore() != null ? Math.round(s.getOverallScore() * 100.0) / 100.0 : 0.0;
                Integer wpm = null;
                String verdict = determineInterviewVerdict(s);
                Instant completedAt = s.getCompletedAt() != null
                        ? s.getCompletedAt().atZone(ZoneId.systemDefault()).toInstant()
                        : (s.getCreatedAt() != null ? s.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant() : Instant.now());

                rows.add(new InterviewRow(s.getId(), s.getId(), userName, userEmail, overallRating, wpm, verdict, completedAt));
            }
        } catch (Exception e) {
            // Fall through with empty list
        }

        Pageable pageable = PageRequest.of(page, size);
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), rows.size());
        List<InterviewRow> pageContent = start > rows.size() ? List.of() : rows.subList(start, end);
        return new PageImpl<>(pageContent, pageable, rows.size());
    }

    @GetMapping("/proctoring-incidents")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<ProctoringIncidentRow> getProctoringIncidents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) Long sessionId) {

        List<ProctoringIncidentRow> rows = new ArrayList<>();
        try {
            List<ProctoringEvent> events;
            if (sessionId != null) {
                events = proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(sessionId);
            } else {
                events = proctoringEventRepository.findAll();
            }

            Map<Long, String> sessionEmailCache = new HashMap<>();

            for (ProctoringEvent e : events) {
                Long sessId = e.getSession() != null ? e.getSession().getId() : null;
                String sessIdStr = sessId != null ? String.valueOf(sessId) : "";
                String userEmail = sessionEmailCache.computeIfAbsent(sessId, id -> {
                    if (id == null) return "unknown";
                    Optional<InterviewSession> sessionOpt = interviewSessionRepository.findById(id);
                    if (sessionOpt.isPresent() && sessionOpt.get().getStudent() != null) {
                        return sessionOpt.get().getStudent().getEmail();
                    }
                    return "unknown";
                });
                Instant createdAt = e.getOccurredAt() != null
                        ? e.getOccurredAt().atZone(ZoneId.systemDefault()).toInstant()
                        : Instant.now();

                rows.add(new ProctoringIncidentRow(
                        e.getId(), sessIdStr,
                        e.getEventType() != null ? e.getEventType().name() : "UNKNOWN",
                        e.getDetails(), createdAt, userEmail
                ));
            }
        } catch (Exception e) {
            // Fall through with empty list
        }

        Pageable pageable = PageRequest.of(page, size);
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), rows.size());
        List<ProctoringIncidentRow> pageContent = start > rows.size() ? List.of() : rows.subList(start, end);
        return new PageImpl<>(pageContent, pageable, rows.size());
    }

    @PostMapping("/generate/{attemptId}")
    public AttemptReport generateMockReport(@PathVariable Long attemptId) {
        User current = currentUserService.getCurrentUser();
        boolean isAdmin = current.getRole() == Role.ADMIN;

        try {
            Optional<AssessmentAttempt> attemptOpt = assessmentAttemptRepository.findById(attemptId);
            if (attemptOpt.isEmpty()) {
                throw ApiException.notFound("Attempt not found with id: " + attemptId);
            }
            AssessmentAttempt attempt = attemptOpt.get();
            boolean isOwner = attempt.getCandidate() != null && attempt.getCandidate().getId().equals(current.getId());
            if (!isAdmin && !isOwner) {
                throw ApiException.forbidden("You do not have access to this attempt");
            }
            return reportingService.generateReport(current, attemptId);
        } catch (ApiException ae) {
            throw ae;
        } catch (Exception e) {
            throw ApiException.notFound("Unable to generate report: " + e.getMessage());
        }
    }

    @PostMapping("/generate-interview/{sessionId}")
    public InterviewReportResponse generateInterviewReport(@PathVariable Long sessionId) {
        User current = currentUserService.getCurrentUser();
        return interviewReportService.generateOrGetReport(sessionId, current);
    }

    @PostMapping("/interview/{sessionId}/retry")
    public InterviewReportResponse retryInterviewReport(@PathVariable Long sessionId) {
        User current = currentUserService.getCurrentUser();
        return interviewReportService.retryReport(sessionId, current);
    }

    @GetMapping("/api/admin/live/attempts")
    @PreAuthorize("hasRole('ADMIN')")
    public LiveAttemptsWrapper getLiveAttempts() {
        try {
            java.util.List<AssessmentAttempt> attempts = assessmentAttemptRepository.findAll();
            java.util.List<LiveAttempt> live = attempts.stream()
                .filter(a -> a.getSubmittedAt() == null)
                .limit(50)
                .map(a -> {
                    String userName = a.getCandidate() != null ? a.getCandidate().getFullName() : "Unknown";
                    String userEmail = a.getCandidate() != null ? a.getCandidate().getEmail() : "";
                    Long userId = a.getCandidate() != null ? a.getCandidate().getId() : 0L;
                    String started = a.getStartedAt() != null ? a.getStartedAt().toString() : "";
                    return new LiveAttempt(a.getId(), userId, userName, userEmail,
                        a.getStatus() != null ? a.getStatus().name() : "UNKNOWN",
                        a.getAssessmentType() != null ? a.getAssessmentType().name() : "UNKNOWN",
                        a.getIntegrityScore(), started, started);
                })
                .toList();
            int completedToday = (int) attempts.stream()
                .filter(a -> a.getSubmittedAt() != null)
                .count();
            int terminatedToday = (int) attempts.stream()
                .filter(a -> a.getStatus() != null
                    && (a.getStatus().name().contains("TERMINATED") || a.getStatus().name().contains("CANCELLED") || a.getStatus().name().contains("VIOLATION")))
                .count();
            return new LiveAttemptsWrapper(live, new LiveSummary(completedToday, terminatedToday));
        } catch (Exception e) {
            return new LiveAttemptsWrapper(java.util.List.of(), new LiveSummary(0, 0));
        }
    }

    private String determineMockVerdict(AssessmentAttempt a, double scorePct) {
        String statusName = a.getStatus() != null ? a.getStatus().name() : "UNKNOWN";
        if (statusName.contains("TERMINATE") || statusName.contains("LOCKED") || statusName.contains("VIOLATION")) {
            return "TERMINATED";
        }
        if (a.getViolationCount() > 0) {
            return "FLAGGED";
        }
        if (scorePct >= 75) return "PASS";
        if (scorePct >= 50) return "CONDITIONAL";
        return "REVIEW";
    }

    private String determineInterviewVerdict(InterviewSession s) {
        String statusName = s.getStatus() != null ? s.getStatus().name() : "UNKNOWN";
        if (statusName.contains("TERMINATE") || statusName.contains("VIOLATION")) return "VIOLATION_DETECTED";
        if (s.getStatus() == InterviewStatus.EXITED) return "EXITED";
        if (s.getStatus() == InterviewStatus.TIMEOUT) return "TIMEOUT";
        if (s.getStatus() == InterviewStatus.ADMIN_TERMINATED) return "ADMIN_TERMINATED";
        if (s.getStatus() == InterviewStatus.CANCELLED) return "CANCELLED";
        if (Boolean.TRUE.equals(s.isFlaggedForReview())) return "FLAGGED";
        Double score = s.getOverallScore();
        if (score == null) {
            if (s.getStatus() == InterviewStatus.IN_PROGRESS || s.getStatus() == InterviewStatus.CREATED || s.getStatus() == InterviewStatus.READY || s.getStatus() == InterviewStatus.PAUSED) {
                return "IN_PROGRESS";
            }
            return "COMPLETED";
        }
        if (score >= 75) return "PASS";
        if (score >= 50) return "CONDITIONAL";
        return "REVIEW";
    }
}
