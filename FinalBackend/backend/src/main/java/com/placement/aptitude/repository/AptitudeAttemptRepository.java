package com.placement.repository;

import com.placement.entity.AptitudeAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AptitudeAttemptRepository extends JpaRepository<AptitudeAttempt, Long> {
    List<AptitudeAttempt> findByStudentIdOrderByAttemptedAtDesc(Long studentId);

    /** Used by AdminService.deleteAptitudeQuestionPermanently to refuse a hard delete before it
     *  hits the DB and fails as a raw FK-violation - question_id references AptitudeQuestion with
     *  no ON DELETE clause (RESTRICT), so any question with attempts cannot be hard-deleted anyway;
     *  this lets the service return a clear "referenced by N attempts, archive instead" message
     *  instead of letting a DataIntegrityViolationException reach the generic 500 handler. */
    long countByQuestion_Id(Long questionId);
}