package com.placement.jobs.service;

import com.placement.exception.ApiException;
import com.placement.jobs.dto.CompanyAdminDtos.HiringRoundDto;
import com.placement.jobs.dto.CompanyAdminDtos.ScheduleConflictDto;
import com.placement.jobs.entity.HiringRound;
import com.placement.jobs.entity.JobOpportunity;
import com.placement.jobs.entity.PipelineSchedulingPolicy;
import com.placement.jobs.entity.RoundLifecycleStatus;
import com.placement.jobs.exception.ScheduleConflictException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@Slf4j
public class RoundScheduleValidator {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final DateTimeFormatter HUMAN_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter HUMAN_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    private record ScheduledInterval(
            int order,
            String name,
            ZonedDateTime start,
            ZonedDateTime end,
            int durationMinutes,
            ZoneId zoneId
    ) {}

    /**
     * Validates round schedules against pipeline scheduling policy.
     * Throws ScheduleConflictException if sequential overlap occurs.
     */
    public void validatePipelineSchedule(List<HiringRoundDto> rounds, PipelineSchedulingPolicy policy) {
        if (rounds == null || rounds.isEmpty()) {
            return;
        }

        PipelineSchedulingPolicy activePolicy = policy != null ? policy : PipelineSchedulingPolicy.SEQUENTIAL;
        List<ScheduledInterval> scheduledRounds = new ArrayList<>();
        List<ScheduleConflictDto> conflicts = new ArrayList<>();

        for (int i = 0; i < rounds.size(); i++) {
            HiringRoundDto r = rounds.get(i);
            int order = r.roundOrder() != null ? r.roundOrder() : (i + 1);
            String roundName = (r.name() != null && !r.name().isBlank()) ? r.name().trim() : ("Round " + order);

            LocalDate startDate = r.startDate();
            LocalTime startTime = r.startTime();

            // If neither date nor time is set, round is unscheduled/open-ended
            if (startDate == null && startTime == null) {
                continue;
            }

            // If only one of date or time is set, require both
            if (startDate == null || startTime == null) {
                throw ApiException.badRequest("Round '" + roundName + "' must specify both a start date and start time.");
            }

            int duration = (r.durationMinutes() != null && r.durationMinutes() > 0) ? r.durationMinutes() : 60;
            ZoneId zone = resolveZoneId(r.timezone());

            ZonedDateTime startZdt;
            try {
                startZdt = ZonedDateTime.of(startDate, startTime, zone);
            } catch (Exception e) {
                throw ApiException.badRequest("Invalid start date/time for round '" + roundName + "': " + e.getMessage());
            }

            ZonedDateTime calculatedEndZdt = startZdt.plusMinutes(duration);
            ZonedDateTime effectiveEndZdt = calculatedEndZdt;

            LocalDate endDate = r.endDate();
            LocalTime endTime = r.endTime();

            if (endDate != null && endTime != null) {
                ZonedDateTime explicitEndZdt;
                try {
                    explicitEndZdt = ZonedDateTime.of(endDate, endTime, zone);
                } catch (Exception e) {
                    throw ApiException.badRequest("Invalid end date/time for round '" + roundName + "': " + e.getMessage());
                }

                if (explicitEndZdt.isBefore(startZdt)) {
                    throw ApiException.badRequest("Round '" + roundName + "' end time (" +
                            explicitEndZdt.format(HUMAN_DATE_TIME_FORMATTER) + ") cannot be before start time (" +
                            startZdt.format(HUMAN_DATE_TIME_FORMATTER) + ").");
                }

                if (!explicitEndZdt.isEqual(calculatedEndZdt)) {
                    throw ApiException.badRequest("Round '" + roundName + "' explicit end time (" +
                            explicitEndZdt.format(HUMAN_DATE_TIME_FORMATTER) + ") does not match configured duration of " +
                            duration + " minutes (expected end time: " + calculatedEndZdt.format(HUMAN_DATE_TIME_FORMATTER) + ").");
                }

                effectiveEndZdt = explicitEndZdt;
            }

            scheduledRounds.add(new ScheduledInterval(order, roundName, startZdt, effectiveEndZdt, duration, zone));
        }

        // Sequential Conflict Validation
        if (activePolicy == PipelineSchedulingPolicy.SEQUENTIAL && scheduledRounds.size() > 1) {
            // Sort by order to ensure progression alignment
            scheduledRounds.sort(Comparator.comparingInt(ScheduledInterval::order));

            for (int currIdx = 1; currIdx < scheduledRounds.size(); currIdx++) {
                ScheduledInterval current = scheduledRounds.get(currIdx);

                for (int prevIdx = 0; prevIdx < currIdx; prevIdx++) {
                    ScheduledInterval previous = scheduledRounds.get(prevIdx);

                    // If current starts before previous ends, conflict!
                    if (current.start.isBefore(previous.end)) {
                        String prevEndIso = previous.end.toLocalDateTime().format(ISO_FORMATTER);
                        String currStartIso = current.start.toLocalDateTime().format(ISO_FORMATTER);
                        String suggestedStartIso = previous.end.toLocalDateTime().format(ISO_FORMATTER);

                        boolean sameDay = previous.end.toLocalDate().equals(current.start.toLocalDate());
                        String prevEndTime = sameDay
                                ? previous.end.format(HUMAN_FORMATTER)
                                : previous.end.format(HUMAN_DATE_TIME_FORMATTER);
                        String currStartTime = sameDay
                                ? current.start.format(HUMAN_FORMATTER)
                                : current.start.format(HUMAN_DATE_TIME_FORMATTER);
                        String suggestedStartTime = sameDay
                                ? previous.end.format(HUMAN_FORMATTER)
                                : previous.end.format(HUMAN_DATE_TIME_FORMATTER);

                        String message = String.format(
                                "Schedule conflict: %s starts at %s, but %s ends at %s. Schedule it at %s or later.",
                                current.name, currStartTime, previous.name, prevEndTime, suggestedStartTime
                        );

                        conflicts.add(new ScheduleConflictDto(
                                previous.name,
                                prevEndIso,
                                current.name,
                                currStartIso,
                                suggestedStartIso,
                                message
                        ));
                    }
                }
            }
        }

        if (!conflicts.isEmpty()) {
            StringBuilder sb = new StringBuilder("The scheduled rounds overlap in sequential pipeline mode: ");
            for (int i = 0; i < conflicts.size(); i++) {
                if (i > 0) sb.append("; ");
                sb.append(conflicts.get(i).message());
            }
            throw new ScheduleConflictException(sb.toString(), conflicts);
        }
    }

    /**
     * Automatically computes and fills in endDate/endTime from startDate, startTime, and durationMinutes if omitted.
     */
    public List<HiringRoundDto> normalizeRoundSchedules(List<HiringRoundDto> rounds) {
        if (rounds == null) return List.of();

        List<HiringRoundDto> normalized = new ArrayList<>();
        for (HiringRoundDto r : rounds) {
            LocalDate startDate = r.startDate();
            LocalTime startTime = r.startTime();
            LocalDate endDate = r.endDate();
            LocalTime endTime = r.endTime();
            int duration = (r.durationMinutes() != null && r.durationMinutes() > 0) ? r.durationMinutes() : 60;
            ZoneId zone = resolveZoneId(r.timezone());

            if (startDate != null && startTime != null && (endDate == null || endTime == null)) {
                ZonedDateTime startZdt = ZonedDateTime.of(startDate, startTime, zone);
                ZonedDateTime endZdt = startZdt.plusMinutes(duration);
                endDate = endZdt.toLocalDate();
                endTime = endZdt.toLocalTime();
            }

            normalized.add(new HiringRoundDto(
                    r.id(),
                    r.roundOrder(),
                    r.name(),
                    r.roundType(),
                    r.durationMinutes(),
                    r.passingScore(),
                    r.weightage(),
                    r.maxAttempts(),
                    r.repeatable(),
                    r.autoUnlock(),
                    r.managementMode(),
                    r.assessmentConfig(),
                    r.roundStatus(),
                    startDate,
                    startTime,
                    endDate,
                    endTime,
                    r.timezone() != null && !r.timezone().isBlank() ? r.timezone() : "Asia/Kolkata",
                    r.isActivated(),
                    r.proctoringConfig()
            ));
        }
        return normalized;
    }

    private ZoneId resolveZoneId(String tz) {
        if (tz == null || tz.isBlank()) {
            return ZoneId.of("Asia/Kolkata");
        }
        try {
            return ZoneId.of(tz.trim());
        } catch (Exception e) {
            return ZoneId.of("Asia/Kolkata");
        }
    }
}
