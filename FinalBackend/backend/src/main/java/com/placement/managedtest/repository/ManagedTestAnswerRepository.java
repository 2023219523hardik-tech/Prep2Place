package com.placement.managedtest.repository;

import com.placement.managedtest.entity.ManagedTestAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ManagedTestAnswerRepository extends JpaRepository<ManagedTestAnswer, Long> {

    List<ManagedTestAnswer> findByAttemptId(Long attemptId);

    Optional<ManagedTestAnswer> findByAttemptIdAndQuestionId(Long attemptId, Long questionId);

    List<ManagedTestAnswer> findByAttemptIdAndSectionId(Long attemptId, Long sectionId);

    /** Per-question difficulty stats for a student, used by the progress rollup. */
    @Query("""
        select count(a), sum(case when a.correct = true then 1 else 0 end)
        from ManagedTestAnswer a
        where a.attempt.student.id = :studentId
        """)
    Object[] aggregateForStudent(@Param("studentId") Long studentId);

    void deleteByAttemptId(Long attemptId);
}
