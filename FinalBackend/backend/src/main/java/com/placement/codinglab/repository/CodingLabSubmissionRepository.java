package com.placement.codinglab.repository;

import com.placement.codinglab.entity.CodingAssessment;
import com.placement.codinglab.entity.CodingLabSubmission;
import com.placement.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CodingLabSubmissionRepository extends JpaRepository<CodingLabSubmission, Long> {

    List<CodingLabSubmission> findByAttemptIdOrderBySubmittedAtDesc(Long attemptId);

    Optional<CodingLabSubmission> findFirstByAttemptIdOrderBySubmittedAtDesc(Long attemptId);

    List<CodingLabSubmission> findByAssessment(CodingAssessment assessment);

    List<CodingLabSubmission> findByCandidateOrderBySubmittedAtDesc(User candidate);
}
