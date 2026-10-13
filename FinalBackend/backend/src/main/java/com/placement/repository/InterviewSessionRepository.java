package com.placement.repository;

import com.placement.entity.InterviewSession;
import com.placement.entity.InterviewStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, Long> {

    @EntityGraph(attributePaths = {"student", "role", "answers", "answers.question"})
    @Query("SELECT s FROM InterviewSession s WHERE s.student.id = :studentId ORDER BY s.createdAt DESC")
    List<InterviewSession> findByStudentIdOrderByCreatedAtDesc(@Param("studentId") Long studentId);

    @EntityGraph(attributePaths = {"student", "role", "answers", "answers.question"})
    @Query("SELECT s FROM InterviewSession s WHERE s.flaggedForReview = true ORDER BY s.completedAt DESC")
    List<InterviewSession> findByFlaggedForReviewTrueOrderByCompletedAtDesc();

    @EntityGraph(attributePaths = {"student", "role", "answers", "answers.question"})
    @Query("SELECT s FROM InterviewSession s WHERE s.id = :id")
    Optional<InterviewSession> findEagerById(@Param("id") Long id);

    @Query("SELECT s FROM InterviewSession s WHERE s.status = :status " +
            "AND (s.lastSeenAt IS NULL OR s.lastSeenAt < :cutoff)")
    List<InterviewSession> findStaleSessions(@Param("status") InterviewStatus status,
                                              @Param("cutoff") LocalDateTime cutoff);
}
