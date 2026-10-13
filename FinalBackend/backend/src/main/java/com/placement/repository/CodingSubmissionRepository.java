package com.placement.repository;

import com.placement.entity.CodingSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CodingSubmissionRepository extends JpaRepository<CodingSubmission, Long> {
    List<CodingSubmission> findByStudentIdOrderBySubmittedAtDesc(Long studentId);
    List<CodingSubmission> findByAttemptIdOrderBySubmittedAtDesc(Long attemptId);
    List<CodingSubmission> findByAttemptIdAndProblemIdOrderBySubmittedAtDesc(Long attemptId, Long problemId);

    /** Used by CodingProblemAdminService to refuse a hard delete before it hits the DB and fails
     *  as a raw FK-violation - problem_id references CodingProblem with no ON DELETE clause
     *  (RESTRICT) - so this lets the service return a clear "referenced by N submissions, archive
     *  instead" message. Same pattern as AptitudeAttemptRepository.countByQuestion_Id. */
    long countByProblem_Id(Long problemId);
}