package com.placement.service;

import com.placement.dto.AptitudeDtos.*;
import com.placement.entity.AptitudeAttempt;
import com.placement.entity.AptitudeQuestion;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.repository.AptitudeAttemptRepository;
import com.placement.repository.AptitudeQuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AptitudeService {
    private final AptitudeQuestionRepository questionRepository;
    private final AptitudeAttemptRepository attemptRepository;

    /** Admin-facing: every question, active or archived - AdminController's
     *  GET /api/admin/aptitude-questions needs archived rows visible so they can be reactivated. */
    public List<AptitudeQuestion> listQuestions() { return questionRepository.findAll(); }

    /** Student-facing: backs AptitudeController's GET /api/aptitude/questions. An archived question
     *  (AdminService.archiveAptitudeQuestion) must stop appearing here immediately - it does not
     *  share listQuestions() above precisely so that fix can never regress by someone "simplifying"
     *  the two call sites back into one. */
    public List<AptitudeQuestion> listActiveQuestions() { return questionRepository.findByActiveTrue(); }

    @Transactional
    public AptitudeAttemptResponse submitAttempt(User student, SubmitAptitudeRequest request) {
        AptitudeQuestion question = questionRepository.findById(request.questionId())
                .orElseThrow(() -> ApiException.notFound("Aptitude question not found"));
        boolean correct = question.getCorrectOption() != null
                && question.getCorrectOption().equalsIgnoreCase(request.selectedOption());
        AptitudeAttempt attempt = AptitudeAttempt.builder()
                .student(student).question(question).selectedOption(request.selectedOption()).correct(correct).build();
        attempt = attemptRepository.save(attempt);
        return toResponse(attempt);
    }

    public AptitudeAttemptResponse getAttempt(Long attemptId) {
        AptitudeAttempt attempt = attemptRepository.findById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        return toResponse(attempt);
    }

    public List<AptitudeAttemptResponse> history(Long studentId) {
        return attemptRepository.findByStudentIdOrderByAttemptedAtDesc(studentId).stream().map(this::toResponse).toList();
    }

    public Map<String, Double> progressByTopic(Long studentId) {
        List<AptitudeAttempt> attempts = attemptRepository.findByStudentIdOrderByAttemptedAtDesc(studentId);
        return attempts.stream().collect(Collectors.groupingBy(
                a -> a.getQuestion().getTopic() == null ? "General" : a.getQuestion().getTopic(),
                Collectors.averagingDouble(a -> a.isCorrect() ? 100.0 : 0.0)));
    }

    public double overallAccuracy(Long studentId) {
        List<AptitudeAttempt> attempts = attemptRepository.findByStudentIdOrderByAttemptedAtDesc(studentId);
        if (attempts.isEmpty()) return 0;
        long correct = attempts.stream().filter(AptitudeAttempt::isCorrect).count();
        return Math.round((correct * 1000.0) / attempts.size()) / 10.0;
    }

    private AptitudeAttemptResponse toResponse(AptitudeAttempt a) {
        return new AptitudeAttemptResponse(a.getId(), a.getQuestion().getId(), a.getSelectedOption(),
                a.getQuestion().getCorrectOption(), a.isCorrect(), a.getQuestion().getExplanation());
    }
}