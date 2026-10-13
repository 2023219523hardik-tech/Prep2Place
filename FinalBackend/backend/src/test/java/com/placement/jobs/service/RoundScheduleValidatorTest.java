package com.placement.jobs.service;

import com.placement.jobs.dto.CompanyAdminDtos.HiringRoundDto;
import com.placement.jobs.dto.CompanyAdminDtos.ScheduleConflictDto;
import com.placement.jobs.entity.HiringRound;
import com.placement.jobs.entity.PipelineSchedulingPolicy;
import com.placement.jobs.exception.ScheduleConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RoundScheduleValidatorTest {

    private RoundScheduleValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RoundScheduleValidator();
    }

    private HiringRoundDto createRoundDto(
            int order,
            String name,
            LocalDate startDate,
            LocalTime startTime,
            int durationMinutes,
            LocalDate endDate,
            LocalTime endTime
    ) {
        return new HiringRoundDto(
                (long) order,
                order,
                name,
                "TECHNICAL_MCQ",
                durationMinutes,
                60.0,
                20.0,
                1,
                false,
                true,
                "AUTOMATIC",
                null,
                "READY",
                startDate,
                startTime,
                endDate,
                endTime,
                "Asia/Kolkata",
                false,
                null
        );
    }

    @Test
    @DisplayName("Acceptance Test 1: Aptitude 17:05-17:35 and Technical MCQ starting 17:30 are rejected under SEQUENTIAL mode")
    void testSequentialOverlapRejected() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Aptitude", date, LocalTime.of(17, 5), 30, date, LocalTime.of(17, 35)),
                createRoundDto(2, "Technical MCQ", date, LocalTime.of(17, 30), 45, date, LocalTime.of(18, 15))
        );

        ScheduleConflictException ex = assertThrows(ScheduleConflictException.class, () ->
                validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.SEQUENTIAL));

        assertEquals("HIRING_ROUND_SCHEDULE_CONFLICT", ex.getErrorCode());
        assertFalse(ex.getConflicts().isEmpty());
        ScheduleConflictDto conflict = ex.getConflicts().get(0);
        assertEquals("Aptitude", conflict.previousRound());
        assertEquals("Technical MCQ", conflict.nextRound());
        assertTrue(conflict.previousEnd().contains("17:35"));
        assertTrue(conflict.nextStart().contains("17:30"));
        assertTrue(ex.getMessage().contains("Technical MCQ"));
        assertTrue(ex.getMessage().contains("Aptitude"));
    }

    @Test
    @DisplayName("Acceptance Test 2: Technical MCQ starting exactly at 17:35 (or later) is accepted")
    void testSequentialAdjacentAccepted() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Aptitude", date, LocalTime.of(17, 5), 30, date, LocalTime.of(17, 35)),
                createRoundDto(2, "Technical MCQ", date, LocalTime.of(17, 35), 45, date, LocalTime.of(18, 20))
        );

        assertDoesNotThrow(() -> validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.SEQUENTIAL));
    }

    @Test
    @DisplayName("Acceptance Test 3: Editing first round cannot silently create a conflict with the second")
    void testEditingFirstRoundTriggersValidation() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        // Admin edits Round 1 duration to 90 mins (ends at 17:30), while Round 2 starts at 17:00
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Aptitude", date, LocalTime.of(16, 0), 90, null, null),
                createRoundDto(2, "Technical MCQ", date, LocalTime.of(17, 0), 45, null, null)
        );

        ScheduleConflictException ex = assertThrows(ScheduleConflictException.class, () ->
                validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.SEQUENTIAL));

        assertEquals("HIRING_ROUND_SCHEDULE_CONFLICT", ex.getErrorCode());
        ScheduleConflictDto conflict = ex.getConflicts().get(0);
        assertEquals("Aptitude", conflict.previousRound());
        assertEquals("Technical MCQ", conflict.nextRound());
        assertTrue(conflict.previousEnd().contains("17:30"));
        assertTrue(conflict.nextStart().contains("17:00"));
    }

    @Test
    @DisplayName("Acceptance Test 4: Duration and calculated end time remain consistent across midnight")
    void testDurationAndEndDateTimeConsistency() {
        LocalDate startDate = LocalDate.of(2026, 10, 12);
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Midnight Coding Challenge", startDate, LocalTime.of(23, 45), 30, null, null)
        );

        List<HiringRoundDto> normalized = validator.normalizeRoundSchedules(rounds);

        assertEquals(1, normalized.size());
        assertEquals(LocalDate.of(2026, 10, 13), normalized.get(0).endDate());
        assertEquals(LocalTime.of(0, 15), normalized.get(0).endTime());
    }

    @Test
    @DisplayName("Acceptance Test 5: Inconsistent explicit end time vs duration is rejected")
    void testInconsistentExplicitEndTimeRejected() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        // Start: 17:05, Duration: 30 (should end 17:35), Explicit End: 17:40
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Aptitude", date, LocalTime.of(17, 5), 30, date, LocalTime.of(17, 40))
        );

        com.placement.exception.ApiException ex = assertThrows(com.placement.exception.ApiException.class, () ->
                validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.SEQUENTIAL));

        assertTrue(ex.getMessage().contains("does not match configured duration"));
    }

    @Test
    @DisplayName("Acceptance Test 6: Multiple conflicts are captured across pipeline rounds")
    void testMultipleConflicts() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Round 1", date, LocalTime.of(10, 0), 60, null, null),
                createRoundDto(2, "Round 2", date, LocalTime.of(10, 30), 60, null, null),
                createRoundDto(3, "Round 3", date, LocalTime.of(11, 15), 60, null, null)
        );

        ScheduleConflictException ex = assertThrows(ScheduleConflictException.class, () ->
                validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.SEQUENTIAL));

        assertEquals(2, ex.getConflicts().size());
        assertEquals("Round 1", ex.getConflicts().get(0).previousRound());
        assertEquals("Round 2", ex.getConflicts().get(0).nextRound());
        assertEquals("Round 2", ex.getConflicts().get(1).previousRound());
        assertEquals("Round 3", ex.getConflicts().get(1).nextRound());
    }

    @Test
    @DisplayName("Acceptance Test 7: INDEPENDENT scheduling policy allows overlapping windows")
    void testIndependentPolicyAllowsOverlap() {
        LocalDate date = LocalDate.of(2026, 10, 12);
        List<HiringRoundDto> rounds = List.of(
                createRoundDto(1, "Aptitude Group A", date, LocalTime.of(17, 5), 30, null, null),
                createRoundDto(2, "Technical MCQ Group B", date, LocalTime.of(17, 15), 45, null, null)
        );

        assertDoesNotThrow(() -> validator.validatePipelineSchedule(rounds, PipelineSchedulingPolicy.INDEPENDENT));
    }
}
