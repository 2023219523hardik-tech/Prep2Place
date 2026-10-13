package com.placement.repository;

import com.placement.entity.InterviewReport;
import com.placement.entity.InterviewSession;
import com.placement.entity.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InterviewReportRepository extends JpaRepository<InterviewReport, Long> {

    @Query("SELECT r FROM InterviewReport r WHERE r.session.id = :sessionId")
    Optional<InterviewReport> findBySessionId(@Param("sessionId") Long sessionId);

    Optional<InterviewReport> findBySession(InterviewSession session);

    @Query("SELECT r FROM InterviewReport r WHERE r.student.id = :studentId ORDER BY r.createdAt DESC")
    List<InterviewReport> findByStudentIdOrderByCreatedAtDesc(@Param("studentId") Long studentId);

    List<InterviewReport> findByStatus(ReportStatus status);

    @Query("SELECT COUNT(r) > 0 FROM InterviewReport r WHERE r.session.id = :sessionId")
    boolean existsBySessionId(@Param("sessionId") Long sessionId);
}
