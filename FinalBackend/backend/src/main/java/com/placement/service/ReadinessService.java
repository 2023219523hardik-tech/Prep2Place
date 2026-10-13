package com.placement.service;

import com.placement.dto.ReadinessDtos.ReadinessResponse;
import com.placement.entity.InterviewSession;
import com.placement.entity.ScoreWeightConfig;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.repository.InterviewSessionRepository;
import com.placement.repository.ScoreWeightConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Combines every practice module's signals into one placement-readiness score using an
 * admin-configurable weighted model. Deterministic and explainable by design — a natural
 * place to layer a trained model once labeled outcome data exists.
 */
@Service
@RequiredArgsConstructor
public class ReadinessService {

    private final CodingService codingService;
    private final AptitudeService aptitudeService;
    private final InterviewSessionRepository interviewSessionRepository;
    private final ScoreWeightConfigRepository weightConfigRepository;
    private final StudentProfileService studentProfileService;

    @Transactional(readOnly = true)
    public ReadinessResponse analyze(User student) {
        ScoreWeightConfig w = weightConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> weightConfigRepository.save(ScoreWeightConfig.builder().build()));

        double dsaScore = avgTopicScores(codingService.progressByTopic(student.getId()));
        double aptitudeScore = aptitudeService.overallAccuracy(student.getId());
        double technicalScore = dsaScore;
        double communicationScore = avgInterviewDimension(student.getId());
        double interviewScore = avgCompletedInterviewScore(student.getId());
        double projectsScore = projectsScore(student);
        double academicsScore = academicsScore(student);

        double totalWeight = w.getDsaWeight() + w.getAptitudeWeight() + w.getTechnicalWeight()
                + w.getCommunicationWeight() + w.getInterviewWeight() + w.getProjectsWeight() + w.getAcademicsWeight();
        if (totalWeight <= 0) totalWeight = 100;

        double overall = (dsaScore * w.getDsaWeight() + aptitudeScore * w.getAptitudeWeight()
                + technicalScore * w.getTechnicalWeight() + communicationScore * w.getCommunicationWeight()
                + interviewScore * w.getInterviewWeight() + projectsScore * w.getProjectsWeight()
                + academicsScore * w.getAcademicsWeight()) / totalWeight;
        overall = round(overall);

        Map<String, Double> breakdown = new LinkedHashMap<>();
        breakdown.put("DSA/Coding", round(dsaScore));
        breakdown.put("Aptitude", round(aptitudeScore));
        breakdown.put("Technical Knowledge", round(technicalScore));
        breakdown.put("Communication", round(communicationScore));
        breakdown.put("Interview", round(interviewScore));
        breakdown.put("Projects", round(projectsScore));
        breakdown.put("Academics", round(academicsScore));

        List<String> weak = new ArrayList<>();
        List<String> strong = new ArrayList<>();
        breakdown.forEach((k, v) -> { if (v < 55) weak.add(k); else if (v >= 75) strong.add(k); });

        String level = overall >= 80 ? "Highly Ready" : overall >= 60 ? "Ready" : overall >= 40 ? "Needs Improvement" : "Not Ready";

        return new ReadinessResponse(overall, level, breakdown, weak, strong);
    }

    private double avgTopicScores(Map<String, Double> topicScores) {
        if (topicScores.isEmpty()) return 0;
        return topicScores.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private double avgCompletedInterviewScore(Long studentId) {
        List<InterviewSession> sessions = interviewSessionRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream()
                .filter(s -> s.getOverallScore() != null).toList();
        if (sessions.isEmpty()) return 0;
        return sessions.stream().mapToDouble(InterviewSession::getOverallScore).average().orElse(0);
    }

    private double avgInterviewDimension(Long studentId) {
        List<InterviewSession> sessions = interviewSessionRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
        List<Double> values = new ArrayList<>();
        for (InterviewSession s : sessions) {
            if (s.getAnswers() != null) {
                for (var a : s.getAnswers()) {
                    if (a.getClarity() != null) values.add(a.getClarity());
                }
            }
        }
        return values.isEmpty() ? 0 : values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private double projectsScore(User student) {
        StudentProfile profile = studentProfileService.getOrCreateProfile(student);
        int count = profile.getProjects() == null ? 0 : profile.getProjects().size();
        return Math.min(100, count * 25.0);
    }

    private double academicsScore(User student) {
        StudentProfile profile = studentProfileService.getOrCreateProfile(student);
        Double cgpa = profile.getCgpa();
        if (cgpa == null) return 0;
        return Math.min(100, (cgpa / 10.0) * 100);
    }

    private double round(double v) { return Math.round(v * 10.0) / 10.0; }
}
