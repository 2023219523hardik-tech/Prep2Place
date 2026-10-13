package com.placement.service;

import com.placement.dto.ProctoringDtos.*;
import com.placement.entity.InterviewSession;
import com.placement.entity.InterviewStatus;
import com.placement.entity.ProctoringEvent;
import com.placement.entity.ProctoringEvent.EvidenceSource;
import com.placement.entity.ProctoringEventType;
import com.placement.exception.ApiException;
import com.placement.repository.InterviewSessionRepository;
import com.placement.repository.ProctoringEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Anti-malpractice / proctoring engine for the interview module — the "safe browser" layer.
 *
 * Two input streams feed this:
 *  1. Browser-lockdown events reported by the frontend proctoring guard (tab switches,
 *     fullscreen exits, copy/paste attempts, right-clicks, devtools shortcuts) — these are
 *     real, deterministic signals (the browser genuinely fired those events).
 *  2. Webcam frame analysis via {@link VideoAnalysisService} (face count, gaze/posture proxy
 *     scores, suspicious objects) — each server-computed signal is logged under its own
 *     event type (see {@link #analyzeFrame}) rather than folded into an unrelated type.
 *
 * Deducts weighted penalties per violation type from a 100-point integrity score and flags
 * a session for human review below a threshold or on any critical violation. Every event that
 * carries visual evidence stores it (access-controlled - see ProctoringController) linked to
 * that specific event id, per Section 1.1's requirement that a reviewer can open the evidence
 * directly from the log entry rather than trusting the label alone.
 */
@Service
@RequiredArgsConstructor
public class ProctoringService {

    private final ProctoringEventRepository eventRepository;
    private final InterviewSessionRepository sessionRepository;
    private final VideoAnalysisService videoAnalysisService;

    /** How many EYE_ROAMING signals within the rolling window below count as sustained gaze
     *  diversion (reading-from-elsewhere heuristic) rather than a brief, normal glance away. */
    private static final int READING_HEURISTIC_THRESHOLD = 3;
    private static final long READING_HEURISTIC_WINDOW_SECONDS = 30;

    /** Below this eye-contact proxy score (0-100), the candidate's gaze is considered off-screen
     *  for that frame. Above this posture-score threshold, posture is considered stable. These
     *  are heuristic thresholds on the ML service's continuous signals, not exact science -
     *  documented here so they can be tuned without hunting through the codebase. */
    private static final double EYE_CONTACT_THRESHOLD = 45.0;
    private static final double POSTURE_THRESHOLD = 45.0;

    @Value("${app.proctoring.evidence-retention-days:30}")
    private int evidenceRetentionDays;

    private static final Map<ProctoringEventType, Double> PENALTY = new EnumMap<>(ProctoringEventType.class);
    static {
        PENALTY.put(ProctoringEventType.TAB_SWITCH, 5.0);
        PENALTY.put(ProctoringEventType.WINDOW_BLUR, 3.0);
        PENALTY.put(ProctoringEventType.FULLSCREEN_EXIT, 10.0);
        PENALTY.put(ProctoringEventType.COPY_PASTE_ATTEMPT, 8.0);
        PENALTY.put(ProctoringEventType.RIGHT_CLICK, 2.0);
        PENALTY.put(ProctoringEventType.DEVTOOLS_OPENED, 20.0);
        PENALTY.put(ProctoringEventType.MULTIPLE_FACES, 15.0);
        PENALTY.put(ProctoringEventType.NO_FACE_DETECTED, 5.0);
        PENALTY.put(ProctoringEventType.MULTIPLE_VOICES, 15.0);
        PENALTY.put(ProctoringEventType.SUSPICIOUS_OBJECT, 20.0);
        PENALTY.put(ProctoringEventType.FILLER_WORDS, 1.0);
        PENALTY.put(ProctoringEventType.POSTURE_DRIFT, 2.0);
        PENALTY.put(ProctoringEventType.MOVEMENT_DETECTED, 2.0);
        PENALTY.put(ProctoringEventType.SCREEN_SHARE_START, 0.0);
        PENALTY.put(ProctoringEventType.SCREEN_SHARE_STOP, 10.0);
        PENALTY.put(ProctoringEventType.AUDIO_MUTED, 5.0);
        PENALTY.put(ProctoringEventType.CONTEXT_MISMATCH, 8.0);
        PENALTY.put(ProctoringEventType.SUSPICIOUS_FRAME, 15.0);
        PENALTY.put(ProctoringEventType.EYE_ROAMING, 3.0);
        PENALTY.put(ProctoringEventType.READING_DETECTED, 18.0);
        PENALTY.put(ProctoringEventType.SCREENSHOT_ATTEMPT, 10.0);
        PENALTY.put(ProctoringEventType.SESSION_TERMINATED, 0.0); // audit marker, not an extra violation on top of its trigger
        PENALTY.put(ProctoringEventType.BACK_NAVIGATION_ATTEMPT, 8.0);
        PENALTY.put(ProctoringEventType.UNAUTHORIZED_SCREEN_SHARE_DETECTED, 15.0);
        PENALTY.put(ProctoringEventType.UNAUTHORIZED_SECOND_SHARE, 15.0);
        PENALTY.put(ProctoringEventType.POTENTIAL_DISPLAY_CAPTURE, 3.0);
        PENALTY.put(ProctoringEventType.EXTENSION_CAPTURE_API_PRESENT, 2.0);
        PENALTY.put(ProctoringEventType.FORMAL_DRESS_NOT_DETECTED, 5.0);
    }

    // Any single occurrence of these is serious enough to flag for human review regardless of score.
    private static final java.util.Set<ProctoringEventType> CRITICAL = java.util.Set.of(
            ProctoringEventType.DEVTOOLS_OPENED, ProctoringEventType.MULTIPLE_FACES,
            ProctoringEventType.SUSPICIOUS_OBJECT, ProctoringEventType.MULTIPLE_VOICES,
            ProctoringEventType.SUSPICIOUS_FRAME, ProctoringEventType.CONTEXT_MISMATCH,
            ProctoringEventType.READING_DETECTED
    );

    /** Events that are lifecycle markers, minor behavioral telemetry, or policy mark deductions
     *  (such as casual attire -5 marks) and must NEVER trigger automatic session termination. */
    private static final java.util.Set<ProctoringEventType> NON_TERMINATING_EVENTS = java.util.Set.of(
            ProctoringEventType.SCREEN_SHARE_START,
            ProctoringEventType.SESSION_TERMINATED,
            ProctoringEventType.FORMAL_DRESS_NOT_DETECTED,
            ProctoringEventType.FILLER_WORDS,
            ProctoringEventType.POSTURE_DRIFT,
            ProctoringEventType.MOVEMENT_DETECTED,
            ProctoringEventType.EYE_ROAMING,
            ProctoringEventType.NO_FACE_DETECTED,
            ProctoringEventType.AUDIO_MUTED,
            ProctoringEventType.POTENTIAL_DISPLAY_CAPTURE,
            ProctoringEventType.EXTENSION_CAPTURE_API_PRESENT
    );

    private static final java.util.Set<InterviewStatus> TERMINAL_STATUSES = java.util.Set.of(
            InterviewStatus.COMPLETED, InterviewStatus.SUBMITTED, InterviewStatus.REPORT_READY,
            InterviewStatus.REPORT_GENERATING, InterviewStatus.EXITED, InterviewStatus.CANCELLED,
            InterviewStatus.TERMINATED_VIOLATION, InterviewStatus.VIOLATION_DETECTED,
            InterviewStatus.TIMEOUT, InterviewStatus.ADMIN_TERMINATED
    );

    /** Nominal duration credited to instantaneous events (no measured duration) when computing
     *  the aggregate "time spent attempting to cheat" metric, so a burst of quick copy-paste
     *  attempts still contributes something rather than the metric only counting continuous
     *  signals like gaze-off-screen or window-blur time. Documented assumption, not a real
     *  measurement. */
    private static final double NOMINAL_INSTANT_EVENT_SECONDS = 2.0;

    @Transactional
    public ProctoringEventResponse recordEvent(Long sessionId, String eventTypeRaw, String details,
                                                Double durationSeconds, String sourceRaw,
                                                byte[] evidenceBytes, String evidenceContentType,
                                                String evidenceUnavailableReason) {
        InterviewSession session = getSession(sessionId);
        ProctoringEventType type;
        try {
            type = ProctoringEventType.valueOf(eventTypeRaw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Unknown proctoring event type: " + eventTypeRaw);
        }

        EvidenceSource source = null;
        if (sourceRaw != null && !sourceRaw.isBlank()) {
            try {
                source = EvidenceSource.valueOf(sourceRaw.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // unknown source hint from an older client - fall through with no source tag
            }
        }

        List<ProctoringEvent> sessionEvents = eventRepository.findBySessionIdOrderByOccurredAtAsc(sessionId);

        // Deduplicate FORMAL_DRESS_NOT_DETECTED across the entire session (only one -5 marks penalty per session),
        // or deduplicate identical events reported within 3 seconds (e.g., server frame analysis + client evidence upload).
        LocalDateTime recentCutoff = LocalDateTime.now().minusSeconds(3);
        java.util.Optional<ProctoringEvent> existingMatch = sessionEvents.stream()
                .filter(ev -> ev.getEventType() == type && (
                        type == ProctoringEventType.FORMAL_DRESS_NOT_DETECTED ||
                        (ev.getOccurredAt() != null && ev.getOccurredAt().isAfter(recentCutoff))
                ))
                .reduce((first, second) -> second);

        if (existingMatch.isPresent()) {
            ProctoringEvent existing = existingMatch.get();
            if (details != null && !details.isBlank()) {
                existing.setDetails(details);
            }
            if (evidenceBytes != null && evidenceBytes.length > 0 && !existing.isEvidenceAvailable()) {
                existing.setFrameCapture(evidenceBytes);
                existing.setEvidenceContentType(evidenceContentType != null ? evidenceContentType : "image/jpeg");
                existing.setEvidenceSource(source);
                existing.setEvidenceUnavailableReason(null);
            }
            return toResponse(eventRepository.save(existing));
        }

        ProctoringEvent.ProctoringEventBuilder builder = ProctoringEvent.builder()
                .session(session).eventType(type).details(details)
                .durationSeconds(durationSeconds).severity(defaultSeverity(type));

        if (evidenceBytes != null && evidenceBytes.length > 0) {
            builder.frameCapture(evidenceBytes)
                    .evidenceContentType(evidenceContentType != null ? evidenceContentType : "image/jpeg")
                    .evidenceSource(source);
        } else {
            builder.evidenceUnavailableReason(
                    evidenceUnavailableReason != null ? evidenceUnavailableReason : "No evidence captured for this event");
        }

        ProctoringEvent event = eventRepository.save(builder.build());

        // Enforce termination ONLY after pre-interview protocol is completed AND only for repeated
        // serious malpractice violations (never on dress-code penalty, screen-share start, or single focus blips).
        boolean alreadyTerminal = TERMINAL_STATUSES.contains(session.getStatus());
        if (!alreadyTerminal && session.isProctoringCompleted() && !NON_TERMINATING_EVENTS.contains(type)) {
            long seriousViolationCount = eventRepository.findBySessionIdOrderByOccurredAtAsc(sessionId).stream()
                    .filter(ev -> !NON_TERMINATING_EVENTS.contains(ev.getEventType()))
                    .count();
            if (seriousViolationCount >= 8 || computeIntegrityScore(sessionId) <= 20.0) {
                terminateForViolation(session, type);
            }
        }

        return toResponse(event);
    }

    /** Ends the session immediately for a policy violation and writes a SESSION_TERMINATED audit
     *  entry into the same log the report reads from, per Section 6's "log every enforcement
     *  action... so termination reasons are auditable." The reason stored here is precise (for
     *  reviewers); the candidate-facing message shown by the frontend is deliberately generic. */
    @Transactional
    public void terminateForViolation(InterviewSession session, ProctoringEventType triggerType) {
        session.setStatus(InterviewStatus.VIOLATION_DETECTED);
        session.setTerminationReason("Session ended: " + triggerType.name().toLowerCase().replace('_', ' ') + " policy violation");
        session.setTerminatedAt(LocalDateTime.now());
        session.setCompletedAt(LocalDateTime.now());
        sessionRepository.save(session);

        eventRepository.save(ProctoringEvent.builder()
                .session(session).eventType(ProctoringEventType.SESSION_TERMINATED)
                .details("Auto-terminated after " + triggerType.name())
                .severity(5)
                .evidenceUnavailableReason("Enforcement action - no separate evidence frame for the termination event itself")
                .build());
    }

    public boolean isTerminal(InterviewStatus status) {
        return TERMINAL_STATUSES.contains(status);
    }

    /** Analyzes one webcam frame and auto-logs any malpractice signals it reveals, each under
     *  its own real event type (fixing the earlier bug where multiple-faces and no-face-detected
     *  were folded into MOVEMENT_DETECTED/POSTURE_DRIFT regardless of what was actually seen). */
    @Transactional
    public FrameAnalysisResponse analyzeFrame(Long sessionId, byte[] frameBytes) {
        InterviewSession session = getSession(sessionId);
        VideoAnalysisService.VideoSignals signals = videoAnalysisService.analyze(frameBytes);

        boolean multipleFaces = signals.faceCount() > 1;
        boolean noFace = signals.faceCount() == 0;
        boolean eyeRoaming = !noFace && !multipleFaces && signals.eyeContactScore() < EYE_CONTACT_THRESHOLD;
        boolean postureDrift = !noFace && !multipleFaces && signals.postureScore() < POSTURE_THRESHOLD;
        boolean reading = false;

        // During the pre-interview protocol window, only return the CV signals for verification
        // without recording interview violations or mutating live interview counters.
        if (!session.isProctoringCompleted()) {
            double currentScore = computeIntegrityScore(sessionId);
            return new FrameAnalysisResponse(signals.faceCount(), multipleFaces, noFace,
                    signals.suspiciousObjectDetected(), eyeRoaming, postureDrift, false, currentScore,
                    signals.formalAttireDetected(), signals.formalAttireDetected() ? "FORMAL" : "CASUAL", signals.attireScore());
        }

        // Section 12: accumulate raw scores for the report's behavioral analysis regardless of
        // whether this particular frame crosses a violation threshold - the report needs a true
        // session-wide average, not just a count of the frames bad enough to log an event.
        session.setFramesAnalyzedCount((session.getFramesAnalyzedCount() == null ? 0 : session.getFramesAnalyzedCount()) + 1);
        session.setEyeContactScoreSum((session.getEyeContactScoreSum() == null ? 0.0 : session.getEyeContactScoreSum()) + signals.eyeContactScore());
        session.setPostureScoreSum((session.getPostureScoreSum() == null ? 0.0 : session.getPostureScoreSum()) + signals.postureScore());
        sessionRepository.save(session);

        if (multipleFaces) {
            saveAutoEvent(session, ProctoringEventType.MULTIPLE_FACES,
                    signals.faceCount() + " faces detected in frame (secondary person present)", null, 0.95);
        }
        if (noFace) {
            saveAutoEvent(session, ProctoringEventType.NO_FACE_DETECTED,
                    "No face detected in frame", null, null);
        }
        if (signals.suspiciousObjectDetected()) {
            saveAutoEvent(session, ProctoringEventType.SUSPICIOUS_OBJECT,
                    "Possible phone/book/second screen detected", null, null);
        }
        if (eyeRoaming) {
            double confidence = 1.0 - (signals.eyeContactScore() / 100.0);
            saveAutoEvent(session, ProctoringEventType.EYE_ROAMING,
                    "Gaze left the screen (eye-contact score " + Math.round(signals.eyeContactScore()) + "/100)",
                    null, confidence);

            // Reading-detection heuristic: several eye-roaming signals clustered in a short
            // window is treated as evidence of reading from an external source, not a single
            // glance. This is explicitly a heuristic (see confidenceScore) - never presented to
            // a reviewer as definitive proof.
            long recentRoaming = eventRepository.countBySessionIdAndEventTypeAndOccurredAtAfter(
                    sessionId, ProctoringEventType.EYE_ROAMING,
                    LocalDateTime.now().minusSeconds(READING_HEURISTIC_WINDOW_SECONDS));
            if (recentRoaming >= READING_HEURISTIC_THRESHOLD) {
                reading = true;
                saveAutoEvent(session, ProctoringEventType.READING_DETECTED,
                        recentRoaming + " sustained gaze-diversion signals in the last "
                                + READING_HEURISTIC_WINDOW_SECONDS + "s — possible reading from another source",
                        (double) READING_HEURISTIC_WINDOW_SECONDS, 0.55);
            }
        }
        if (postureDrift) {
            saveAutoEvent(session, ProctoringEventType.POSTURE_DRIFT,
                    "Posture instability detected (posture score " + Math.round(signals.postureScore()) + "/100)",
                    null, 1.0 - (signals.postureScore() / 100.0));
        }

        double liveScore = computeIntegrityScore(sessionId);
        return new FrameAnalysisResponse(signals.faceCount(), multipleFaces, noFace,
                signals.suspiciousObjectDetected(), eyeRoaming, postureDrift, reading, liveScore,
                signals.formalAttireDetected(), signals.formalAttireDetected() ? "FORMAL" : "CASUAL", signals.attireScore());
    }

    private void saveAutoEvent(InterviewSession session, ProctoringEventType type, String details,
                                Double durationSeconds, Double confidenceScore) {
        eventRepository.save(ProctoringEvent.builder()
                .session(session).eventType(type).details(details)
                .durationSeconds(durationSeconds).confidenceScore(confidenceScore)
                .severity(defaultSeverity(type))
                .evidenceUnavailableReason("Server-side frame analysis event — evidence is attached "
                        + "separately by the client from the same webcam frame when available")
                .build());
    }

    private int defaultSeverity(ProctoringEventType type) {
        double penalty = PENALTY.getOrDefault(type, 5.0);
        if (penalty >= 15) return 5;
        if (penalty >= 8) return 4;
        if (penalty >= 5) return 3;
        if (penalty >= 3) return 2;
        return 1;
    }

    public double computeIntegrityScore(Long sessionId) {
        List<ProctoringEvent> events = eventRepository.findBySessionIdOrderByOccurredAtAsc(sessionId);
        double score = 100.0;
        for (ProctoringEvent e : events) {
            score -= PENALTY.getOrDefault(e.getEventType(), 5.0);
        }
        return Math.max(0, Math.round(score * 10.0) / 10.0);
    }

    /** Aggregate "time spent attempting to cheat" across every suspicious signal — Section 1's
     *  required distinct metric. Duration-based events contribute their measured duration;
     *  instantaneous events contribute a documented nominal amount rather than being ignored. */
    public double computeTotalCheatTimeSeconds(List<ProctoringEvent> events) {
        double total = 0.0;
        for (ProctoringEvent e : events) {
            if (e.getEventType() == ProctoringEventType.SCREEN_SHARE_START
                    || e.getEventType() == ProctoringEventType.SESSION_TERMINATED
                    || e.getEventType() == ProctoringEventType.FORMAL_DRESS_NOT_DETECTED) {
                continue;
            }
            total += e.getDurationSeconds() != null ? e.getDurationSeconds() : NOMINAL_INSTANT_EVENT_SECONDS;
        }
        return Math.round(total * 10.0) / 10.0;
    }

    public ProctoringSummaryResponse getSummary(Long sessionId) {
        List<ProctoringEvent> events = eventRepository.findBySessionIdOrderByOccurredAtAsc(sessionId);
        double score = computeIntegrityScore(sessionId);

        Map<String, Long> counts = events.stream()
                .collect(Collectors.groupingBy(e -> e.getEventType().name(), Collectors.counting()));

        boolean hasCritical = events.stream().anyMatch(e -> CRITICAL.contains(e.getEventType()));
        boolean flagged = score < 60 || hasCritical;

        List<ProctoringEventResponse> eventResponses = events.stream().map(this::toResponse).toList();

        return new ProctoringSummaryResponse(score, flagged, counts,
                computeTotalCheatTimeSeconds(events), eventResponses);
    }

    /** Called when an interview is completed — persists the final integrity score onto the session. */
    @Transactional
    public void finalizeForSession(InterviewSession session) {
        ProctoringSummaryResponse summary = getSummary(session.getId());
        session.setIntegrityScore(summary.integrityScore());
        session.setFlaggedForReview(summary.flaggedForReview());

        List<ProctoringEvent> events = eventRepository.findBySessionIdOrderByOccurredAtAsc(session.getId());
        long filler = events.stream().filter(e -> e.getEventType() == ProctoringEventType.FILLER_WORDS).count();
        long movement = events.stream().filter(e -> e.getEventType() == ProctoringEventType.MOVEMENT_DETECTED).count();
        long posture = events.stream().filter(e -> e.getEventType() == ProctoringEventType.POSTURE_DRIFT).count();
        long tabSwitch = events.stream().filter(e -> e.getEventType() == ProctoringEventType.TAB_SWITCH).count();

        session.setFillerWordCount((int) filler);
        session.setMovementEventCount((int) movement);
        session.setPostureFlagCount((int) posture);
        session.setTabSwitchCount((int) tabSwitch);

        sessionRepository.save(session);
    }

    /** Fetches evidence bytes for one event, enforcing that it belongs to the given session so
     *  the access-controlled evidence endpoint can't be used to pull another candidate's frames
     *  by guessing event ids. Returns null if there is no evidence (never fabricates a placeholder). */
    @Transactional(readOnly = true)
    public EvidencePayload getEvidence(Long sessionId, Long eventId) {
        ProctoringEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Violation event not found"));
        if (!event.getSession().getId().equals(sessionId)) {
            throw ApiException.forbidden("This evidence does not belong to the given session");
        }
        if (!event.isEvidenceAvailable()) {
            throw ApiException.notFound("No evidence stored for this event");
        }
        return new EvidencePayload(event.getFrameCapture(),
                event.getEvidenceContentType() != null ? event.getEvidenceContentType() : "image/jpeg");
    }

    public record EvidencePayload(byte[] bytes, String contentType) {}

    /** Retention purge (Section 1.1): stored violation media is only kept for a configured
     *  window; beyond that the raw bytes are dropped but the event metadata (type, timestamp,
     *  severity) is kept for audit purposes, with evidenceUnavailableReason explaining why the
     *  image is gone rather than silently disappearing. Runs once a day. */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeExpiredEvidence() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(evidenceRetentionDays);
        List<ProctoringEvent> expired = eventRepository.findByOccurredAtBeforeAndFrameCaptureIsNotNull(cutoff);
        for (ProctoringEvent e : expired) {
            e.setFrameCapture(null);
            e.setEvidenceContentType(null);
            e.setEvidenceUnavailableReason("Evidence purged after the " + evidenceRetentionDays + "-day retention window");
        }
        eventRepository.saveAll(expired);
    }

    private InterviewSession getSession(Long sessionId) {
        return sessionRepository.findById(sessionId).orElseThrow(() -> ApiException.notFound("Interview session not found"));
    }

    ProctoringEventResponse toResponse(ProctoringEvent e) {
        String evidenceUrl = e.isEvidenceAvailable()
                ? "/api/interviews/" + e.getSession().getId() + "/proctoring/events/" + e.getId() + "/evidence"
                : null;
        InterviewSession s = e.getSession();
        boolean terminated = s != null && (s.getStatus() == InterviewStatus.TERMINATED_VIOLATION
                || s.getStatus() == InterviewStatus.VIOLATION_DETECTED);
        return new ProctoringEventResponse(
                e.getId(), e.getEventType().name(), e.getDetails(), e.getOccurredAt(),
                e.getSeverity(), e.getDurationSeconds(), e.getConfidenceScore(),
                e.isEvidenceAvailable(), evidenceUrl, e.getEvidenceUnavailableReason(),
                e.getEvidenceSource() != null ? e.getEvidenceSource().name() : null,
                terminated, (terminated && s != null) ? s.getTerminationReason() : null);
    }

    @Transactional
    public PreInterviewCheckResponse verifyPreInterviewProtocol(Long sessionId, PreInterviewCheckRequest request) {
        InterviewSession session = getSession(sessionId);

        session.setCameraChecked(request.camera());
        session.setMicChecked(request.microphone());
        session.setScreenShareChecked(request.screenShare());
        session.setTabMonitoringChecked(request.tabMonitoring());
        session.setBackgroundChecked(request.backgroundCheck());
        session.setFormalDressChecked(request.formalDressCheck());
        session.setFaceDetectionChecked(request.faceDetection());
        session.setIdentityChecked(request.identityCheck());
        if (request.formalDressConfidence() != null) {
            session.setFormalDressConfidence(request.formalDressConfidence());
        }
        if (request.formalDressClassification() != null) {
            session.setFormalDressClassification(request.formalDressClassification());
        }

        boolean coreChecksPassed = request.camera()
                && request.microphone()
                && request.screenShare()
                && request.tabMonitoring()
                && request.backgroundCheck()
                && request.faceDetection();

        boolean isCasualOrUncertain = !"FORMAL".equalsIgnoreCase(request.formalDressClassification())
                || !request.formalDressCheck();

        if (coreChecksPassed) {
            session.setProctoringCompleted(true);
            session.setProctoringStatus(com.placement.entity.ProctoringState.COMPLETED);
            session.setFormalDressChecked(true); // Allow candidate to proceed to interview
            if (session.getStatus() == InterviewStatus.CREATED || session.getStatus() == InterviewStatus.READY) {
                session.setStatus(InterviewStatus.READY);
            }

            // If candidate opted or attended without formal attire, record policy violation & deduct 5 marks
            if (isCasualOrUncertain) {
                session.setFormalDressClassification("CASUAL");
                boolean alreadyLogged = eventRepository.countBySessionIdAndEventTypeAndOccurredAtAfter(
                        sessionId, ProctoringEventType.FORMAL_DRESS_NOT_DETECTED, java.time.LocalDateTime.now().minusHours(1)) > 0;
                if (!alreadyLogged) {
                    recordEvent(sessionId, ProctoringEventType.FORMAL_DRESS_NOT_DETECTED.name(),
                            "Casual attire penalty (-5 marks): Candidate attended interview in non-formal attire.",
                            null, "WEBCAM", null, null, null);
                }
            }

            sessionRepository.save(session);
            return new PreInterviewCheckResponse(
                    session.getProctoringStatus().name(),
                    session.isCameraChecked(),
                    session.isMicChecked(),
                    session.isScreenShareChecked(),
                    session.isTabMonitoringChecked(),
                    session.isBackgroundChecked(),
                    session.isFormalDressChecked(),
                    session.isFaceDetectionChecked(),
                    session.isIdentityChecked(),
                    true,
                    isCasualOrUncertain
                            ? "Verification completed with casual attire penalty (-5 marks). Proctoring is READY."
                            : "Pre-interview verification successfully completed. Proctoring is READY."
            );
        } else {
            session.setProctoringCompleted(false);
            session.setProctoringStatus(com.placement.entity.ProctoringState.IN_PROGRESS);
            sessionRepository.save(session);
            return new PreInterviewCheckResponse(
                    session.getProctoringStatus().name(),
                    session.isCameraChecked(),
                    session.isMicChecked(),
                    session.isScreenShareChecked(),
                    session.isTabMonitoringChecked(),
                    session.isBackgroundChecked(),
                    session.isFormalDressChecked(),
                    session.isFaceDetectionChecked(),
                    session.isIdentityChecked(),
                    false,
                    "Mandatory pre-interview verification checks are still pending."
            );
        }
    }

    @Transactional
    public DressAnalysisResult verifyDressFrames(Long sessionId, List<org.springframework.web.multipart.MultipartFile> files) throws java.io.IOException {
        InterviewSession session = getSession(sessionId);
        List<byte[]> frameBytes = new java.util.ArrayList<>();
        if (files != null) {
            for (org.springframework.web.multipart.MultipartFile file : files) {
                if (file != null && !file.isEmpty()) {
                    frameBytes.add(file.getBytes());
                }
            }
        }

        DressAnalysisResult result = videoAnalysisService.analyzeClothingFrames(frameBytes);
        session.setFormalDressClassification(result.classification());
        session.setFormalDressConfidence(result.confidence());

        sessionRepository.save(session);
        return result;
    }

    @Transactional(readOnly = true)
    public PreInterviewCheckResponse getPreInterviewStatus(Long sessionId) {
        InterviewSession session = getSession(sessionId);
        return new PreInterviewCheckResponse(
                session.getProctoringStatus() != null ? session.getProctoringStatus().name() : com.placement.entity.ProctoringState.NOT_STARTED.name(),
                session.isCameraChecked(),
                session.isMicChecked(),
                session.isScreenShareChecked(),
                session.isTabMonitoringChecked(),
                session.isBackgroundChecked(),
                session.isFormalDressChecked(),
                session.isFaceDetectionChecked(),
                session.isIdentityChecked(),
                session.isProctoringCompleted(),
                session.isProctoringCompleted() ? "Proctoring checks completed." : "Proctoring checks in progress."
        );
    }
}
