package com.placement.managedtest.service;

import com.placement.assessment.entity.AttemptStatus;
import com.placement.assessment.entity.IntegrityEvent;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.ManagedTestAttempt;
import com.placement.managedtest.repository.ManagedTestAttemptRepository;
import com.placement.service.AuditLogService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Read-only observation layer over the data that already exists: ManagedTestAttempt for progress
 * (startedAt, serverExpiresAt, sectionState, violationCount, integrityScore - all already
 * maintained by ManagedTestAttemptService's existing save/submit/reportViolation paths) and
 * IntegrityEvent for the per-signal event history (already maintained by
 * ManagedTestAttemptService.reportViolation). This class introduces no new progress-tracking or
 * proctoring mechanism of its own - it is deliberately just a read side over both, matching spec
 * section 53's "observe existing proctoring events... DO NOT BUILD A SECOND PROCTORING SYSTEM".
 *
 * Real-time push (WebSocket/SSE) is intentionally not implemented here yet - see the engineering
 * notes for this delivery. These endpoints are safe to poll on a several-second interval scoped to
 * one test's active list or one student's detail, which is not the "poll the entire database every
 * second" pattern spec section 60 warns against, but it is an interim measure, not the end state.
 */
@Service
@RequiredArgsConstructor
public class ManagedTestLiveMonitoringService {

    private static final int RECENT_EVENT_LIMIT = 50;

    private final ManagedTestAttemptRepository attemptRepository;
    private final IntegrityEventRepository integrityEventRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<Long> testIdsWithActiveAttempts() {
        return attemptRepository.findTestIdsWithActiveAttempts();
    }

    @Transactional(readOnly = true)
    public List<LiveStudentSummary> activeStudents(Long testId) {
        return attemptRepository.findByTestIdAndStatus(testId, AttemptStatus.IN_PROGRESS).stream()
                .map(a -> new LiveStudentSummary(
                        a.getId(), a.getStudent().getId(), a.getStudent().getFullName(), a.getStudent().getEmail(),
                        a.getStartedAt(), a.getServerExpiresAt(), a.getViolationCount(), a.getIntegrityScore(),
                        a.getStatus().name()))
                .toList();
    }

    /** Records LIVE_SESSION_VIEWED (spec section 63) every time this is called - an admin opening
     *  a student's detailed live session is itself the auditable action, not just the data read. */
    @Transactional
    public LiveStudentDetail studentDetail(Long testId, Long studentId) {
        User admin = currentUserService.getCurrentUser();
        ManagedTestAttempt attempt = attemptRepository
                .findFirstByTestIdAndStudentIdAndStatus(testId, studentId, AttemptStatus.IN_PROGRESS)
                .orElseThrow(() -> ApiException.notFound(
                        "No active attempt for this student on this test - they may have already finished or not started."));

        List<LiveIntegrityEventView> recentEvents = integrityEventRepository
                .findByAttemptKindAndAttemptIdOrderByOccurredAtAsc(IntegrityEvent.AttemptKind.MANAGED_TEST, attempt.getId())
                .stream()
                .sorted(Comparator.comparing(IntegrityEvent::getOccurredAt).reversed())
                .limit(RECENT_EVENT_LIMIT)
                .map(e -> new LiveIntegrityEventView(e.getId(), e.getEventType().name(),
                        e.getClassification() == null ? null : e.getClassification().name(),
                        e.getOccurredAt(), e.getSeverity(), e.getDetails(), e.isEvidenceAvailable()))
                .toList();

        auditLogService.record(admin, "LIVE_SESSION_VIEWED", "ManagedTestAttempt", attempt.getId(),
                "testId=" + testId + " studentId=" + studentId);

        return new LiveStudentDetail(attempt.getId(), attempt.getStudent().getId(), attempt.getStudent().getFullName(),
                attempt.getStudent().getEmail(), attempt.getStartedAt(), attempt.getServerExpiresAt(),
                attempt.getViolationCount(), attempt.getIntegrityScore(), attempt.getStatus().name(),
                attempt.getSectionState(), recentEvents);
    }
}