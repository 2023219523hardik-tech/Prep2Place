package com.placement.assessment.repository;

import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.entity.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, Long> {

    List<AssessmentAttempt> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);

    /** Used to enforce "one active attempt per candidate per profile" and for resume-on-refresh. */
    Optional<AssessmentAttempt> findFirstByCandidateIdAndProfileIdAndStatusIn(
            Long candidateId, Long profileId, List<AttemptStatus> statuses);

    List<AssessmentAttempt> findByStatusAndServerExpiresAtBefore(AttemptStatus status, Instant cutoff);

    List<AssessmentAttempt> findByCandidateIdAndAssessmentTypeOrderByCreatedAtDesc(Long candidateId, com.placement.assessment.entity.AssessmentType type);
}
