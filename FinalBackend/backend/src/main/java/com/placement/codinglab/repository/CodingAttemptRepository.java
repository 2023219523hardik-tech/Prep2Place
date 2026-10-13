package com.placement.codinglab.repository;

import com.placement.codinglab.entity.CodingAssessment;
import com.placement.codinglab.entity.CodingAttempt;
import com.placement.codinglab.entity.CodingAttemptStatus;
import com.placement.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CodingAttemptRepository extends JpaRepository<CodingAttempt, Long> {

    List<CodingAttempt> findByCandidateOrderByCreatedAtDesc(User candidate);

    List<CodingAttempt> findByAssessment(CodingAssessment assessment);

    /** A list (not Optional): a double-click on "Start" must never crash later lookups with a non-unique result. */
    List<CodingAttempt> findByCandidateAndAssessmentAndStatus(User candidate, CodingAssessment assessment, CodingAttemptStatus status);

    @Query("select a from CodingAttempt a where a.status = com.placement.codinglab.entity.CodingAttemptStatus.STARTED " +
            "and a.expiresAt < CURRENT_TIMESTAMP")
    List<CodingAttempt> findExpiredButStillOpen();
}
