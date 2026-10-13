package com.placement.controller;

import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.entity.AptitudeAttempt;
import com.placement.entity.CodingSubmission;
import com.placement.entity.InterviewSession;
import com.placement.entity.JobRole;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.repository.AptitudeAttemptRepository;
import com.placement.repository.CodingSubmissionRepository;
import com.placement.repository.InterviewSessionRepository;
import com.placement.service.CurrentUserService;
import com.placement.service.StudentProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
@Slf4j
public class ProgressController {

    private final CurrentUserService currentUserService;
    private final CodingSubmissionRepository codingSubmissionRepository;
    private final AptitudeAttemptRepository aptitudeAttemptRepository;
    private final InterviewSessionRepository interviewSessionRepository;
    private final StudentProfileService studentProfileService;
    private final AssessmentAttemptRepository assessmentAttemptRepository;

    private static final int MAX_HISTORY = 100;
    private static final long DEFAULT_TOTAL_AVAILABLE = 100;

    public record SectionStats(long attempted, long correct, long totalAvailable, double scorePct) {}
    public record CategoryBreakdown(SectionStats dsa, SectionStats sql, SectionStats dataframe,
                                     SectionStats techMcq, SectionStats aptitude) {}
    public record Milestone(String name, boolean done, String targetDate) {}
    public record GoalResponse(String targetRole, List<String> targetCompanies, double progressPct,
                                List<Milestone> milestones) {}
    public record DayActivity(String day, int mocktestCount, int interviewCount,
                               int questionsSolved, int minutesSpent) {}
    public record ActivityResponse(String weekStart, List<DayActivity> days) {}

    @GetMapping("/breakdown")
    public ResponseEntity<CategoryBreakdown> breakdown() {
        SectionStats zeroStats = new SectionStats(0, 0, DEFAULT_TOTAL_AVAILABLE, 0.0);
        CategoryBreakdown defaultResponse = new CategoryBreakdown(zeroStats, zeroStats, zeroStats, zeroStats, zeroStats);
        try {
            User user = currentUserService.getCurrentUser();

            List<CodingSubmission> codingSubmissions = codingSubmissionRepository.findByStudentIdOrderBySubmittedAtDesc(user.getId());
            long dsaAttempted = codingSubmissions.size();
            long dsaCorrect = codingSubmissions.stream()
                    .filter(s -> "PASSED".equals(s.getVerdict()))
                    .count();
            double dsaPct = dsaAttempted == 0 ? 0.0 : Math.round((dsaCorrect * 10000.0) / dsaAttempted) / 100.0;
            SectionStats dsaStats = new SectionStats(dsaAttempted, dsaCorrect, DEFAULT_TOTAL_AVAILABLE, dsaPct);

            SectionStats sqlStats = new SectionStats(0, 0, DEFAULT_TOTAL_AVAILABLE, 0.0);
            SectionStats dataframeStats = new SectionStats(0, 0, DEFAULT_TOTAL_AVAILABLE, 0.0);
            SectionStats techMcqStats = new SectionStats(0, 0, DEFAULT_TOTAL_AVAILABLE, 0.0);

            List<AptitudeAttempt> aptitudeAttempts = aptitudeAttemptRepository.findByStudentIdOrderByAttemptedAtDesc(user.getId());
            long aptAttempted = aptitudeAttempts.size();
            long aptCorrect = aptitudeAttempts.stream()
                    .filter(AptitudeAttempt::isCorrect)
                    .count();
            double aptPct = aptAttempted == 0 ? 0.0 : Math.round((aptCorrect * 10000.0) / aptAttempted) / 100.0;
            SectionStats aptStats = new SectionStats(aptAttempted, aptCorrect, DEFAULT_TOTAL_AVAILABLE, aptPct);

            CategoryBreakdown result = new CategoryBreakdown(dsaStats, sqlStats, dataframeStats, techMcqStats, aptStats);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error computing progress breakdown", e);
            return ResponseEntity.ok(defaultResponse);
        }
    }

    @GetMapping("/goal")
    public ResponseEntity<GoalResponse> goal() {
        GoalResponse defaultResponse = new GoalResponse("Not Set", List.of(), 0.0, List.of());
        try {
            User user = currentUserService.getCurrentUser();
            StudentProfile profile = studentProfileService.getOrCreateProfile(user);

            String targetRole = "Not Set";
            if (profile.getTargetRole() != null && profile.getTargetRole().getTitle() != null) {
                targetRole = profile.getTargetRole().getTitle();
            }

            List<String> targetCompanies = List.of();
            if (profile.getPreferredCompanies() != null && !profile.getPreferredCompanies().isBlank()) {
                targetCompanies = Arrays.stream(profile.getPreferredCompanies().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
            }

            double progressPct = 0.0;
            try {
                long codingScore = profile.getCodingScore() != null ? profile.getCodingScore() : 0;
                long aptScore = profile.getAptitudeScore() != null ? profile.getAptitudeScore() : 0;
                long interviewScore = profile.getInterviewScore() != null ? profile.getInterviewScore() : 0;
                long total = codingScore + aptScore + interviewScore;
                if (total > 0) {
                    progressPct = Math.round(Math.min(100.0, (total / 3.0)) * 10.0) / 10.0;
                }
            } catch (Exception ignored) {}

            return ResponseEntity.ok(new GoalResponse(targetRole, targetCompanies, progressPct, List.of()));
        } catch (Exception e) {
            log.error("Error computing progress goal", e);
            return ResponseEntity.ok(defaultResponse);
        }
    }

    @GetMapping("/activity")
    public ResponseEntity<ActivityResponse> activity() {
        ActivityResponse defaultResponse = buildDefaultActivity();
        try {
            User user = currentUserService.getCurrentUser();

            LocalDate today = LocalDate.now(ZoneId.of("UTC"));
            LocalDate weekStart = today.minusDays(6);
            String weekStartStr = weekStart.format(DateTimeFormatter.ISO_LOCAL_DATE);

            String[] dayLabels = new String[7];
            int[] mocktestCounts = new int[7];
            int[] interviewCounts = new int[7];
            int[] questionsSolvedCounts = new int[7];
            int[] minutesSpentCounts = new int[7];

            for (int i = 0; i < 7; i++) {
                LocalDate day = weekStart.plusDays(i);
                DayOfWeek dow = day.getDayOfWeek();
                dayLabels[i] = switch (dow) {
                    case MONDAY -> "Mon";
                    case TUESDAY -> "Tue";
                    case WEDNESDAY -> "Wed";
                    case THURSDAY -> "Thu";
                    case FRIDAY -> "Fri";
                    case SATURDAY -> "Sat";
                    case SUNDAY -> "Sun";
                };
            }

            try {
                List<CodingSubmission> codingSubs = codingSubmissionRepository.findByStudentIdOrderBySubmittedAtDesc(user.getId());
                List<AptitudeAttempt> aptAttempts = aptitudeAttemptRepository.findByStudentIdOrderByAttemptedAtDesc(user.getId());
                List<InterviewSession> interviews = interviewSessionRepository.findByStudentIdOrderByCreatedAtDesc(user.getId());
                List<com.placement.assessment.entity.AssessmentAttempt> mockTests = assessmentAttemptRepository.findByCandidateIdOrderByCreatedAtDesc(user.getId());

                for (CodingSubmission s : codingSubs) {
                    if (s.getSubmittedAt() == null) continue;
                    LocalDate sd = s.getSubmittedAt().atZone(ZoneOffset.UTC).toLocalDate();
                    int idx = (int) (sd.toEpochDay() - weekStart.toEpochDay());
                    if (idx >= 0 && idx < 7) {
                        questionsSolvedCounts[idx]++;
                        minutesSpentCounts[idx] += 5;
                    }
                }

                for (AptitudeAttempt a : aptAttempts) {
                    if (a.getAttemptedAt() == null) continue;
                    LocalDate ad = a.getAttemptedAt().atZone(ZoneOffset.UTC).toLocalDate();
                    int idx = (int) (ad.toEpochDay() - weekStart.toEpochDay());
                    if (idx >= 0 && idx < 7) {
                        questionsSolvedCounts[idx]++;
                        minutesSpentCounts[idx] += 2;
                    }
                }

                for (com.placement.assessment.entity.AssessmentAttempt a : mockTests) {
                    if (a.getCreatedAt() == null) continue;
                    LocalDate ad = a.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
                    int idx = (int) (ad.toEpochDay() - weekStart.toEpochDay());
                    if (idx >= 0 && idx < 7) {
                        mocktestCounts[idx]++;
                        minutesSpentCounts[idx] += 30;
                    }
                }

                for (InterviewSession s : interviews) {
                    if (s.getCreatedAt() == null) continue;
                    LocalDate sd = s.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
                    int idx = (int) (sd.toEpochDay() - weekStart.toEpochDay());
                    if (idx >= 0 && idx < 7) {
                        interviewCounts[idx]++;
                        minutesSpentCounts[idx] += 20;
                    }
                }
            } catch (Exception ex) {
                log.warn("Partial activity aggregation failed for userId={}", user.getId(), ex);
            }

            List<DayActivity> days = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                days.add(new DayActivity(dayLabels[i], mocktestCounts[i], interviewCounts[i],
                        questionsSolvedCounts[i], minutesSpentCounts[i]));
            }

            return ResponseEntity.ok(new ActivityResponse(weekStartStr, days));
        } catch (Exception e) {
            log.error("Error computing progress activity", e);
            return ResponseEntity.ok(defaultResponse);
        }
    }

    private ActivityResponse buildDefaultActivity() {
        LocalDate weekStart = LocalDate.now(ZoneId.of("UTC")).minusDays(6);
        String weekStartStr = weekStart.format(DateTimeFormatter.ISO_LOCAL_DATE);
        List<DayActivity> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = weekStart.plusDays(i);
            DayOfWeek dow = day.getDayOfWeek();
            String label = switch (dow) {
                case MONDAY -> "Mon";
                case TUESDAY -> "Tue";
                case WEDNESDAY -> "Wed";
                case THURSDAY -> "Thu";
                case FRIDAY -> "Fri";
                case SATURDAY -> "Sat";
                case SUNDAY -> "Sun";
            };
            days.add(new DayActivity(label, 0, 0, 0, 0));
        }
        return new ActivityResponse(weekStartStr, days);
    }
}
