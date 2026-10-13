package com.placement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.placement.dto.InterviewDtos.InterviewReportResponse;
import com.placement.entity.*;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.InterviewReportRepository;
import com.placement.repository.InterviewSessionRepository;
import com.placement.repository.ProctoringEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterviewReportServiceTest {

    @Mock
    private InterviewSessionRepository sessionRepository;

    @Mock
    private InterviewReportRepository reportRepository;

    @Mock
    private ProctoringEventRepository proctoringEventRepository;

    @Mock
    private ProctoringService proctoringService;

    @Mock
    private CodingProblemRepository codingProblemRepository;

    private ObjectMapper objectMapper;
    private InterviewReportService reportService;

    private User student;
    private InterviewSession session;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        reportService = new InterviewReportService(
                sessionRepository,
                reportRepository,
                proctoringEventRepository,
                proctoringService,
                codingProblemRepository,
                objectMapper
        );

        student = User.builder()
                .id(1L)
                .email("student@example.com")
                .role(Role.STUDENT)
                .build();

        session = InterviewSession.builder()
                .id(100L)
                .student(student)
                .status(InterviewStatus.COMPLETED)
                .technicalScore(85.0)
                .behavioralScore(80.0)
                .confidenceScore(90.0)
                .overallScore(85.0)
                .integrityScore(95.0)
                .answers(Collections.emptyList())
                .build();
    }

    @Test
    @DisplayName("isTerminalInterviewStatus returns true for all terminal states")
    void testIsTerminalInterviewStatus() {
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.COMPLETED));
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.EXITED));
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.VIOLATION_DETECTED));
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.TERMINATED_VIOLATION));
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.TIMEOUT));
        assertTrue(reportService.isTerminalInterviewStatus(InterviewStatus.ADMIN_TERMINATED));

        assertFalse(reportService.isTerminalInterviewStatus(InterviewStatus.IN_PROGRESS));
        assertFalse(reportService.isTerminalInterviewStatus(null));
    }

    @Test
    @DisplayName("Completed interview generates and persists report")
    void testGenerateOrGetReport_Completed() {
        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));
        when(reportRepository.findBySessionId(100L)).thenReturn(Optional.empty());
        when(proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(100L)).thenReturn(Collections.emptyList());
        when(reportRepository.save(any(InterviewReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InterviewReportResponse response = reportService.generateOrGetReport(100L, student);

        assertNotNull(response);
        assertEquals(100L, response.sessionId());
        assertEquals("COMPLETED", response.completionState());
        assertEquals("GENERATED", response.reportStatus());
        assertEquals(85.0, response.overallScore());

        ArgumentCaptor<InterviewReport> captor = ArgumentCaptor.forClass(InterviewReport.class);
        verify(reportRepository, atLeastOnce()).save(captor.capture());
        InterviewReport savedReport = captor.getValue();
        assertEquals(ReportStatus.GENERATED, savedReport.getStatus());
        assertEquals("COMPLETED", savedReport.getTerminalStatus());
        assertNotNull(savedReport.getReportData());
    }

    @Test
    @DisplayName("Exited interview generates report with safe default scores and exit reason")
    void testGenerateOrGetReport_Exited() {
        session.setStatus(InterviewStatus.EXITED);
        session.setTerminationReason("User clicked exit button");
        session.setTechnicalScore(null);
        session.setOverallScore(null);

        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));
        when(reportRepository.findBySessionId(100L)).thenReturn(Optional.empty());
        when(proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(100L)).thenReturn(Collections.emptyList());
        when(reportRepository.save(any(InterviewReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InterviewReportResponse response = reportService.generateOrGetReport(100L, student);

        assertNotNull(response);
        assertEquals("EXITED", response.completionState());
        assertEquals("User clicked exit button", response.exitReason());
        assertEquals(0.0, response.overallScore()); // Safe default instead of NPE
        assertEquals("GENERATED", response.reportStatus());
    }

    @Test
    @DisplayName("Violation detected interview generates report with proctoring violations")
    void testGenerateOrGetReport_ViolationDetected() {
        session.setStatus(InterviewStatus.VIOLATION_DETECTED);
        session.setTerminationReason("Screen share stopped");

        ProctoringEvent event = ProctoringEvent.builder()
                .id(1L)
                .session(session)
                .eventType(ProctoringEventType.SCREEN_SHARE_STOP)
                .details("Candidate stopped screen share")
                .occurredAt(LocalDateTime.now())
                .severity(3)
                .build();

        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));
        when(reportRepository.findBySessionId(100L)).thenReturn(Optional.empty());
        when(proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(100L)).thenReturn(List.of(event));
        when(reportRepository.save(any(InterviewReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InterviewReportResponse response = reportService.generateOrGetReport(100L, student);

        assertNotNull(response);
        assertEquals("VIOLATION_DETECTED", response.completionState());
        assertEquals("Screen share stopped", response.exitReason());
        assertEquals("GENERATED", response.reportStatus());
    }

    @Test
    @DisplayName("Idempotency: existing generated report is returned directly without re-saving")
    void testGenerateOrGetReport_Idempotent() throws Exception {
        InterviewReport existingReport = InterviewReport.builder()
                .id(10L)
                .session(session)
                .student(student)
                .status(ReportStatus.GENERATED)
                .terminalStatus("COMPLETED")
                .overallScore(85.0)
                .build();

        InterviewReportResponse cachedResponse = reportService.buildResilientReport(session);
        existingReport.setReportData(objectMapper.writeValueAsString(cachedResponse));

        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));
        when(reportRepository.findBySessionId(100L)).thenReturn(Optional.of(existingReport));

        InterviewReportResponse result = reportService.generateOrGetReport(100L, student);

        assertNotNull(result);
        assertEquals(100L, result.sessionId());
        assertEquals("COMPLETED", result.completionState());
        // Verify save was not called since cached report was returned
        verify(reportRepository, never()).save(any(InterviewReport.class));
    }

    @Test
    @DisplayName("retryReport forces report regeneration and persists updated report")
    void testRetryReport() {
        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));
        when(reportRepository.findBySessionId(100L)).thenReturn(Optional.empty());
        when(proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(100L)).thenReturn(Collections.emptyList());
        when(reportRepository.save(any(InterviewReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InterviewReportResponse result = reportService.retryReport(100L, student);

        assertNotNull(result);
        assertEquals("GENERATED", result.reportStatus());
        verify(reportRepository, atLeastOnce()).save(any(InterviewReport.class));
    }

    @Test
    @DisplayName("Access is forbidden when another student attempts to view report")
    void testAccessControlForbidden() {
        User otherStudent = User.builder().id(999L).role(Role.STUDENT).build();
        when(sessionRepository.findEagerById(100L)).thenReturn(Optional.of(session));

        assertThrows(com.placement.exception.ApiException.class, () ->
                reportService.generateOrGetReport(100L, otherStudent));
    }

    @Test
    @DisplayName("Resilient against completely null fields on session")
    void testResilienceToNullFields() {
        InterviewSession emptySession = InterviewSession.builder()
                .id(200L)
                .student(student)
                .status(InterviewStatus.EXITED)
                .answers(null)
                .overallScore(null)
                .technicalScore(null)
                .behavioralScore(null)
                .confidenceScore(null)
                .integrityScore(null)
                .terminationReason(null)
                .build();

        when(proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(200L)).thenReturn(Collections.emptyList());

        InterviewReportResponse report = reportService.buildResilientReport(emptySession);
        assertNotNull(report);
        assertEquals(0.0, report.overallScore());
        assertEquals(0.0, report.technicalScore());
        assertEquals(100.0, report.integrityScore());
        assertEquals("Candidate exited early", report.exitReason());
    }
}
