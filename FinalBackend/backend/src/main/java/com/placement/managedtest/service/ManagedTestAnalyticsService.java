package com.placement.managedtest.service;

import com.placement.assessment.entity.IntegrityEvent;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.*;
import com.placement.managedtest.repository.*;
import com.placement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Read-only aggregation for the admin dashboard and student-progress screens.
 *
 * Everything here is computed with COUNT/AVG queries rather than by loading attempts into memory,
 * because these endpoints are polled by a dashboard and would otherwise dominate DB time as attempt
 * volume grows.
 */
@Service
@RequiredArgsConstructor
public class ManagedTestAnalyticsService {

    private final ManagedTestRepository testRepository;
    private final ManagedTestAttemptRepository attemptRepository;
    private final ManagedTestAnswerRepository answerRepository;
    private final ManagedTestQuestionRepository questionRepository;
    private final ManagedTestSectionRepository sectionRepository;
    private final IntegrityEventRepository integrityEventRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public TestAnalyticsResponse testAnalytics() {
        long submitted = attemptRepository.countSubmitted();
        long passed = attemptRepository.countPassed();
        return new TestAnalyticsResponse(
                testRepository.countByActiveTrue(),
                testRepository.countByStatusAndActiveTrue(TestStatus.PUBLISHED),
                testRepository.countByStatusAndActiveTrue(TestStatus.ACTIVE),
                testRepository.countByStatusAndActiveTrue(TestStatus.DRAFT),
                testRepository.countByTestTypeAndActiveTrue(TestType.UNIVERSITY_TEST),
                testRepository.countByTestTypeAndActiveTrue(TestType.CUSTOM_TEST),
                testRepository.countByTestTypeAndActiveTrue(TestType.TECHNICAL_MCQ_TEST),
                testRepository.countByStatusAndActiveTrue(TestStatus.COMPLETED),
                attemptRepository.count(),
                round(orZero(attemptRepository.averagePercentage())),
                round(orZero(attemptRepository.averageAccuracy())),
                submitted > 0 ? round(passed * 100d / submitted) : 0d
        );
    }

    @Transactional(readOnly = true)
    public TestActivityResponse activity() {
        Instant dayStart = Instant.now().truncatedTo(ChronoUnit.DAYS);
        return new TestActivityResponse(
                attemptRepository.countStartedSince(dayStart),
                attemptRepository.countSubmittedSince(dayStart),
                attemptRepository.findTop10ByOrderBySubmittedAtDesc().stream()
                        .filter(a -> a.getSubmittedAt() != null)
                        .map(this::toSummary).toList(),
                leaderboard(attemptRepository.aggregateByTest(PageRequest.of(0, 5))),
                leaderboard(attemptRepository.aggregateByTestWorst(PageRequest.of(0, 5)))
        );
    }

    private List<TestLeaderboardRow> leaderboard(List<Object[]> rows) {
        List<TestLeaderboardRow> out = new ArrayList<>();
        for (Object[] row : rows) {
            out.add(new TestLeaderboardRow((Long) row[0], (String) row[1],
                    ((Number) row[2]).longValue(), round(row[3] == null ? 0d : ((Number) row[3]).doubleValue())));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public IntegritySummaryResponse integrity() {
        List<IntegrityEvent> recent = integrityEventRepository.findRecent(
                IntegrityEvent.AttemptKind.MANAGED_TEST, PageRequest.of(0, 20));

        Map<Long, ManagedTestAttempt> attempts = new HashMap<>();
        for (IntegrityEvent e : recent) {
            attemptRepository.findWithRefsById(e.getAttemptId()).ifPresent(a -> attempts.put(e.getAttemptId(), a));
        }

        List<ViolationRow> rows = recent.stream().map(e -> {
            ManagedTestAttempt a = attempts.get(e.getAttemptId());
            return new ViolationRow(e.getId(), e.getAttemptId(),
                    a != null ? a.getStudent().getId() : null,
                    a != null ? a.getStudent().getFullName() : null,
                    a != null ? a.getTest().getId() : null,
                    a != null ? a.getTest().getName() : null,
                    e.getEventType().name(), e.getSeverity(), e.getOccurredAt(), e.getDetails());
        }).toList();

        // "Requires review" is a low integrity score, not a cheating verdict: it flags attempts an
        // admin should look at, and the events themselves are shown alongside so they can judge.
        long requiringReview = rows.stream().map(ViolationRow::attemptId).distinct()
                .filter(id -> {
                    ManagedTestAttempt a = attempts.get(id);
                    return a != null && a.getIntegrityScore() < 70;
                }).count();

        double avgIntegrity = attempts.values().stream()
                .mapToInt(ManagedTestAttempt::getIntegrityScore).average().orElse(100d);

        return new IntegritySummaryResponse(
                integrityEventRepository.countByAttemptKind(IntegrityEvent.AttemptKind.MANAGED_TEST),
                requiringReview, rows, round(avgIntegrity));
    }

    @Transactional(readOnly = true)
    public List<ViolationRow> attemptViolations(Long attemptId) {
        ManagedTestAttempt attempt = attemptRepository.findWithRefsById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt not found"));
        return integrityEventRepository
                .findByAttemptKindAndAttemptIdOrderByOccurredAtAsc(IntegrityEvent.AttemptKind.MANAGED_TEST, attemptId)
                .stream()
                .map(e -> new ViolationRow(e.getId(), attemptId, attempt.getStudent().getId(),
                        attempt.getStudent().getFullName(), attempt.getTest().getId(), attempt.getTest().getName(),
                        e.getEventType().name(), e.getSeverity(), e.getOccurredAt(), e.getDetails()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AttemptSummaryResponse> attemptsForTest(Long testId, int page, int size) {
        return attemptRepository.findByTestId(testId, PageRequest.of(page, Math.min(size, 100)))
                .map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public Page<AttemptSummaryResponse> attemptsForStudent(Long studentId, int page, int size) {
        return attemptRepository.findByStudentId(studentId, PageRequest.of(page, Math.min(size, 100)))
                .map(this::toSummary);
    }

    /**
     * Per-student rollup that feeds both the admin student-detail screen and the student's own
     * progress page. Section-type, topic and difficulty performance are derived from the stored
     * per-attempt resultDetails, so this does not re-grade anything.
     */
    @Transactional(readOnly = true)
    public StudentProgressResponse studentProgress(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> ApiException.notFound("Student not found"));

        List<ManagedTestAttempt> attempts = attemptRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
        List<ManagedTestAttempt> completed = attempts.stream().filter(ManagedTestAttempt::isTerminal).toList();

        int questionsAttempted = completed.stream().mapToInt(a -> a.getCorrectCount() + a.getWrongCount()).sum();
        int questionsCorrect = completed.stream().mapToInt(ManagedTestAttempt::getCorrectCount).sum();

        Map<String, int[]> topics = new LinkedHashMap<>();
        Map<String, int[]> difficulties = new LinkedHashMap<>();
        Map<String, double[]> sectionTypes = new LinkedHashMap<>();

        for (ManagedTestAttempt attempt : completed) {
            mergeRatios(topics, attempt.getResultDetails().get("topics"));
            mergeRatios(difficulties, attempt.getResultDetails().get("difficulty"));

            Object sections = attempt.getResultDetails().get("sections");
            if (sections instanceof Map<?, ?> map) {
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    Long sectionId = parseLong(entry.getKey());
                    if (sectionId == null || !(entry.getValue() instanceof Map<?, ?> stats)) continue;
                    sectionRepository.findById(sectionId).ifPresent(section -> {
                        double[] agg = sectionTypes.computeIfAbsent(section.getSectionType().name(), k -> new double[2]);
                        agg[0] += num(stats.get("scored"));
                        agg[1] += num(stats.get("total"));
                    });
                }
            }
        }

        Map<String, Double> sectionPerformance = new LinkedHashMap<>();
        sectionTypes.forEach((type, agg) -> sectionPerformance.put(type, agg[1] > 0 ? round(agg[0] / agg[1] * 100d) : 0d));

        List<ReadinessPoint> trend = completed.stream()
                .sorted(Comparator.comparing(a -> a.getSubmittedAt() == null ? a.getCreatedAt() : a.getSubmittedAt()))
                .map(a -> new ReadinessPoint(
                        a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getCreatedAt(),
                        a.getTest().getName(), a.getPercentage()))
                .toList();

        return new StudentProgressResponse(
                student.getId(), student.getFullName(),
                attempts.size(), completed.size(), questionsAttempted, questionsCorrect,
                questionsAttempted > 0 ? round(questionsCorrect * 100d / questionsAttempted) : 0d,
                completed.isEmpty() ? 0d : round(completed.stream().mapToDouble(ManagedTestAttempt::getPercentage).average().orElse(0d)),
                sectionPerformance, toAccuracyMap(topics), toAccuracyMap(difficulties),
                trend,
                attempts.stream().limit(10).map(this::toSummary).toList()
        );
    }

    // ------------------------------------------------------------------ helpers

    private void mergeRatios(Map<String, int[]> sink, Object raw) {
        if (!(raw instanceof Map<?, ?> map)) return;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> stats)) continue;
            int[] agg = sink.computeIfAbsent(String.valueOf(entry.getKey()), k -> new int[2]);
            agg[0] += (int) num(stats.get("attempted"));
            agg[1] += (int) num(stats.get("correct"));
        }
    }

    private Map<String, Double> toAccuracyMap(Map<String, int[]> counts) {
        Map<String, Double> out = new LinkedHashMap<>();
        counts.forEach((key, v) -> out.put(key, v[0] > 0 ? round(v[1] * 100d / v[0]) : 0d));
        return out;
    }

    private AttemptSummaryResponse toSummary(ManagedTestAttempt a) {
        return new AttemptSummaryResponse(
                a.getId(), a.getTest().getId(), a.getTest().getName(), a.getTest().getTestType(),
                a.getStudent().getId(), a.getStudent().getFullName(), a.getStudent().getEmail(),
                a.getStatus().name(), a.getAttemptNumber(), a.getStartedAt(), a.getSubmittedAt(),
                a.getScoredMarks(), a.getTotalMarks(), a.getPercentage(), a.getAccuracy(),
                a.isPassed(), a.getViolationCount(), a.getIntegrityScore());
    }

    private Long parseLong(Object o) {
        try { return Long.valueOf(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
    }

    private double num(Object o) { return o instanceof Number n ? n.doubleValue() : 0d; }

    private double orZero(Double d) { return d == null ? 0d : d; }

    private double round(double v) { return Math.round(v * 100d) / 100d; }
}
