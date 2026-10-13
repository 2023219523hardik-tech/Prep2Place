package com.placement.jobs.service;

import com.placement.email.EmailService;
import com.placement.entity.User;
import com.placement.jobs.entity.CandidateReminder;
import com.placement.jobs.entity.HiringRound;
import com.placement.jobs.entity.JobApplication;
import com.placement.jobs.entity.JobApplicationStatus;
import com.placement.jobs.repository.CandidateReminderRepository;
import com.placement.jobs.repository.JobApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CandidateReminderService {

    private final CandidateReminderRepository reminderRepository;
    private final JobApplicationRepository applicationRepository;
    private final EmailService emailService;

    @Value("${app.url:http://localhost:3000}")
    private String appUrl;

    /**
     * Idempotently schedules 72-hour and 24-hour reminders for an active or scheduled round.
     */
    @Transactional
    public void scheduleRemindersForRound(HiringRound round, LocalDateTime roundStartTime) {
        if (round == null || roundStartTime == null || round.getJob() == null) {
            return;
        }

        LocalDateTime t72 = roundStartTime.minusHours(72);
        LocalDateTime t24 = roundStartTime.minusHours(24);
        LocalDateTime now = LocalDateTime.now();

        List<JobApplication> eligibleApps = applicationRepository.findByJobId(round.getJob().getId());

        for (JobApplication app : eligibleApps) {
            // Only schedule for active, shortlisted, or in-progress candidates (not disqualified or rejected)
            if (app.getStatus() == JobApplicationStatus.DISQUALIFIED || app.getStatus() == JobApplicationStatus.REJECTED) {
                continue;
            }

            // 72-Hour Reminder
            if (!reminderRepository.existsByApplicationIdAndRoundIdAndReminderType(app.getId(), round.getId(), "SEVENTY_TWO_HOURS")) {
                CandidateReminder r72 = CandidateReminder.builder()
                        .application(app)
                        .round(round)
                        .reminderType("SEVENTY_TWO_HOURS")
                        .scheduledFor(t72.isAfter(now) ? t72 : now)
                        .status("PENDING")
                        .build();
                reminderRepository.save(r72);
            }

            // 24-Hour Reminder
            if (!reminderRepository.existsByApplicationIdAndRoundIdAndReminderType(app.getId(), round.getId(), "TWENTY_FOUR_HOURS")) {
                CandidateReminder r24 = CandidateReminder.builder()
                        .application(app)
                        .round(round)
                        .reminderType("TWENTY_FOUR_HOURS")
                        .scheduledFor(t24.isAfter(now) ? t24 : now)
                        .status("PENDING")
                        .build();
                reminderRepository.save(r24);
            }
        }

        log.info("Scheduled reminders for Round ID {} with start time {}", round.getId(), roundStartTime);
    }

    /**
     * Updates timestamps for pending reminders if the round start time changes.
     */
    @Transactional
    public void rescheduleRemindersForRound(Long roundId, LocalDateTime newStartTime) {
        if (roundId == null || newStartTime == null) return;

        List<CandidateReminder> pending = reminderRepository.findByRoundIdAndStatus(roundId, "PENDING");
        LocalDateTime t72 = newStartTime.minusHours(72);
        LocalDateTime t24 = newStartTime.minusHours(24);

        for (CandidateReminder r : pending) {
            if ("SEVENTY_TWO_HOURS".equalsIgnoreCase(r.getReminderType())) {
                r.setScheduledFor(t72);
            } else if ("TWENTY_FOUR_HOURS".equalsIgnoreCase(r.getReminderType())) {
                r.setScheduledFor(t24);
            }
            reminderRepository.save(r);
        }
        log.info("Rescheduled {} pending reminders for Round ID {}", pending.size(), roundId);
    }

    /**
     * Cancels any pending reminders if the round or job is cancelled.
     */
    @Transactional
    public void cancelRemindersForRound(Long roundId) {
        if (roundId == null) return;
        List<CandidateReminder> pending = reminderRepository.findByRoundIdAndStatus(roundId, "PENDING");
        for (CandidateReminder r : pending) {
            r.setStatus("CANCELLED");
            reminderRepository.save(r);
        }
        log.info("Cancelled {} pending reminders for Round ID {}", pending.size(), roundId);
    }

    /**
     * Periodic background dispatcher running every minute to process due reminders.
     */
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void dispatchDueReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<CandidateReminder> due = reminderRepository.findByStatusAndScheduledForLessThanEqual("PENDING", now);

        if (due.isEmpty()) {
            return;
        }

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm");

        for (CandidateReminder r : due) {
            JobApplication app = r.getApplication();
            HiringRound round = r.getRound();

            // Candidate state check: Disqualified or rejected candidates do not receive reminders
            if (app.getStatus() == JobApplicationStatus.DISQUALIFIED || app.getStatus() == JobApplicationStatus.REJECTED) {
                r.setStatus("CANCELLED");
                reminderRepository.save(r);
                continue;
            }

            try {
                User candidate = app.getApplicant();
                String companyName = app.getJob().getCompany();
                String roundName = round.getName();
                String startTimeFormatted = r.getScheduledFor().plusHours(
                        "SEVENTY_TWO_HOURS".equalsIgnoreCase(r.getReminderType()) ? 72 : 24
                ).format(dtf);
                String duration = String.valueOf(round.getDurationMinutes() != null ? round.getDurationMinutes() : 60);
                String testUrl = (appUrl != null ? appUrl.replaceAll("/+$", "") : "http://localhost:3000") + "/jobs/hiring-progress";

                emailService.sendRoundReminderEmail(
                        candidate.getEmail(),
                        candidate.getFullName(),
                        companyName,
                        roundName,
                        startTimeFormatted,
                        duration,
                        testUrl
                );

                r.setStatus("SENT");
                r.setSentAt(LocalDateTime.now());
                reminderRepository.save(r);
                log.info("Successfully dispatched {} reminder to {}", r.getReminderType(), candidate.getEmail());
            } catch (Exception ex) {
                log.warn("Failed to dispatch reminder ID {}: {}", r.getId(), ex.getMessage());
                r.setStatus("FAILED");
                reminderRepository.save(r);
            }
        }
    }
}
