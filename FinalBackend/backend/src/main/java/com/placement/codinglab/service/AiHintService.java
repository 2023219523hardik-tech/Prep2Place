package com.placement.codinglab.service;

import com.placement.codinglab.ai.AiHintGuardrailService;
import com.placement.codinglab.ai.AiHintResponseProvider;
import com.placement.codinglab.ai.AiHintResponseProvider.HintContext;
import com.placement.codinglab.ai.AiHintResponseProvider.HintResponse;
import com.placement.codinglab.dto.CodingLabDtos.AiHintInteractionView;
import com.placement.codinglab.dto.CodingLabDtos.AiUsageView;
import com.placement.codinglab.dto.CodingLabDtos.HintResponseView;
import com.placement.codinglab.entity.*;
import com.placement.codinglab.repository.AiHintInteractionRepository;
import com.placement.codinglab.repository.CodingAttemptRepository;
import com.placement.codinglab.repository.CodingLabSubmissionRepository;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Enforces the AI Hint Assistant's usage policy (Section 19) and audit trail (Section 20) around
 * whichever {@link AiHintResponseProvider} is wired in. Context restriction (Section 18) is
 * structural here: this class never reads {@code hiddenTestFiles}, official solutions, or other
 * students' submissions - it only ever builds a {@link HintContext} from the assessment's public
 * title/description, the student's own message, and their own most recent error.
 */
@Service
@RequiredArgsConstructor
public class AiHintService {

    private final CodingLabService codingLabService;
    private final CodingAttemptRepository attemptRepository;
    private final CodingLabSubmissionRepository submissionRepository;
    private final AiHintInteractionRepository interactionRepository;
    private final AiHintGuardrailService guardrail;
    private final AiHintResponseProvider responseProvider;

    @Transactional
    public HintResponseView requestHint(User candidate, Long attemptId, String message) {
        CodingAttempt attempt = codingLabService.getOwnedAttemptOrThrow(candidate, attemptId);
        CodingAssessment assessment = attempt.getAssessment();

        if (!assessment.isAiAssistantEnabled()) {
            throw ApiException.forbidden("The AI Hint Assistant is disabled for this assessment");
        }
        if (message == null || message.isBlank()) {
            throw ApiException.badRequest("message is required");
        }

        Instant now = Instant.now();
        if (attempt.getLastAiRequestAt() != null) {
            long elapsed = Duration.between(attempt.getLastAiRequestAt(), now).getSeconds();
            if (elapsed < assessment.getAiCooldownSeconds()) {
                long waitFor = assessment.getAiCooldownSeconds() - elapsed;
                throw ApiException.conflict("Please wait " + waitFor + "s before requesting another hint");
            }
        }
        if (attempt.getAiRequestsUsed() >= assessment.getAiMaxRequests()) {
            return logAndReturn(attempt, message, AiHintClassification.ALLOWED_HINT, AiHintResponseType.LIMIT_REACHED,
                    "You've reached the maximum number of AI Assistant requests for this assessment.", true);
        }

        attempt.setAiRequestsUsed(attempt.getAiRequestsUsed() + 1);
        attempt.setLastAiRequestAt(now);

        AiHintClassification classification = guardrail.classify(message);

        if (classification == AiHintClassification.ALLOWED_HINT
                && attempt.getAiHintsUsed() >= assessment.getAiMaxHints()) {
            attemptRepository.save(attempt);
            return logAndReturn(attempt, message, classification, AiHintResponseType.LIMIT_REACHED,
                    "You've used all " + assessment.getAiMaxHints() + " hints available for this assessment. "
                            + "Try working through what you have so far, or revisit the problem statement.", true);
        }

        String lastError = lastErrorFor(attempt);
        String statement = assessment.getProblemStatement() != null && !assessment.getProblemStatement().isBlank()
                ? assessment.getProblemStatement() : assessment.getDescription();
        HintContext context = new HintContext(assessment.getCodingType(), assessment.getTitle(),
                statement, message, lastError, classification);
        HintResponse response = responseProvider.respond(context);

        boolean countsAsHint = classification == AiHintClassification.ALLOWED_HINT
                && response.responseType() != AiHintResponseType.LIMIT_REACHED;
        if (countsAsHint) {
            attempt.setAiHintsUsed(attempt.getAiHintsUsed() + 1);
        }
        attemptRepository.save(attempt);

        boolean blocked = classification == AiHintClassification.RESTRICTED_SOLVE_REQUEST;
        return logAndReturn(attempt, message, classification, response.responseType(), response.text(), blocked);
    }

    private String lastErrorFor(CodingAttempt attempt) {
        List<com.placement.codinglab.entity.CodingLabSubmission> submissions =
                submissionRepository.findByAttemptIdOrderBySubmittedAtDesc(attempt.getId());
        if (submissions.isEmpty()) return null;
        var latest = submissions.get(0);
        if (latest.getCompilationError() != null && !latest.getCompilationError().isBlank()) return latest.getCompilationError();
        if (latest.getRuntimeError() != null && !latest.getRuntimeError().isBlank()) return latest.getRuntimeError();
        return null;
    }

    private HintResponseView logAndReturn(CodingAttempt attempt, String message, AiHintClassification classification,
                                           AiHintResponseType responseType, String text, boolean blocked) {
        AiHintInteraction interaction = AiHintInteraction.builder()
                .attemptId(attempt.getId())
                .candidateId(attempt.getCandidate().getId())
                .assessmentId(attempt.getAssessment().getId())
                .requestedAt(Instant.now())
                .studentMessage(message.length() > 2000 ? message.substring(0, 2000) : message)
                .classification(classification)
                .responseType(responseType)
                .responseText(text.length() > 3000 ? text.substring(0, 3000) : text)
                .blocked(blocked)
                .hintCountAfter(attempt.getAiHintsUsed())
                .build();
        interactionRepository.save(interaction);

        int hintsRemaining = Math.max(0, attempt.getAssessment().getAiMaxHints() - attempt.getAiHintsUsed());
        int requestsRemaining = Math.max(0, attempt.getAssessment().getAiMaxRequests() - attempt.getAiRequestsUsed());
        return new HintResponseView(classification, responseType, text, attempt.getAiHintsUsed(), hintsRemaining,
                requestsRemaining);
    }

    public List<AiHintInteraction> interactionsForAttempt(Long attemptId) {
        return interactionRepository.findByAttemptIdOrderByRequestedAtAsc(attemptId);
    }

    @Transactional
    public AiUsageView usage(User candidate, Long attemptId) {
        CodingAttempt attempt = codingLabService.getOwnedAttemptOrThrow(candidate, attemptId);
        List<AiHintInteractionView> interactions = interactionsForAttempt(attemptId).stream()
                .map(AiHintInteractionView::from).toList();
        CodingAssessment a = attempt.getAssessment();
        return new AiUsageView(attempt.getAiHintsUsed(), a.getAiMaxHints(), attempt.getAiRequestsUsed(),
                a.getAiMaxRequests(), a.getAiCooldownSeconds(), interactions);
    }
}
