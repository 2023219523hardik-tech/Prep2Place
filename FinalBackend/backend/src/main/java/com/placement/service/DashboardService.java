package com.placement.service;

import com.placement.dto.DashboardDtos.*;
import com.placement.dto.ReadinessDtos.ReadinessResponse;
import com.placement.entity.InterviewSession;
import com.placement.entity.User;
import com.placement.repository.CodingSubmissionRepository;
import com.placement.repository.AptitudeAttemptRepository;
import com.placement.repository.InterviewSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ReadinessService readinessService;
    private final CodingService codingService;
    private final AptitudeService aptitudeService;
    private final InterviewSessionRepository interviewSessionRepository;
    private final CodingSubmissionRepository codingSubmissionRepository;
    private final AptitudeAttemptRepository aptitudeAttemptRepository;

    public DashboardResponse getDashboard(User student) {
        ReadinessResponse readiness = readinessService.analyze(student);

        Map<String, Double> codingByTopic = codingService.progressByTopic(student.getId());
        double avgCoding = codingByTopic.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double avgAptitude = aptitudeService.overallAccuracy(student.getId());

        List<InterviewSession> sessions = interviewSessionRepository.findByStudentIdOrderByCreatedAtDesc(student.getId());
        double avgInterview = sessions.stream().filter(s -> s.getOverallScore() != null)
                .mapToDouble(InterviewSession::getOverallScore).average().orElse(0);

        List<RecentActivity> activity = new java.util.ArrayList<>();
        sessions.stream().limit(5).forEach(s -> activity.add(new RecentActivity(
                "INTERVIEW", "Mock interview (" + s.getStatus() + ") - " + s.getLevel(),
                s.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))));
        codingSubmissionRepository.findByStudentIdOrderBySubmittedAtDesc(student.getId()).stream().limit(5)
                .forEach(sub -> activity.add(new RecentActivity("CODING",
                        "Submission for " + sub.getProblem().getTitle() + " - " + sub.getVerdict(),
                        sub.getSubmittedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))));
        aptitudeAttemptRepository.findByStudentIdOrderByAttemptedAtDesc(student.getId()).stream().limit(5)
                .forEach(a -> activity.add(new RecentActivity("APTITUDE",
                        "Aptitude attempt - " + (a.isCorrect() ? "Correct" : "Incorrect"),
                        a.getAttemptedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))));

        return new DashboardResponse(
                student.getFullName(), readiness.overallScore(), readiness.readinessLevel(),
                round(avgCoding), round(avgAptitude), round(avgInterview),
                sessions.size(),
                codingSubmissionRepository.findByStudentIdOrderBySubmittedAtDesc(student.getId()).size(),
                aptitudeAttemptRepository.findByStudentIdOrderByAttemptedAtDesc(student.getId()).size(),
                readiness.categoryBreakdown(), activity
        );
    }

    private double round(double v) { return Math.round(v * 10.0) / 10.0; }
}
