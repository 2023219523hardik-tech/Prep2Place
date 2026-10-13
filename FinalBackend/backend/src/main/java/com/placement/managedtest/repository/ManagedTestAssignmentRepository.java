package com.placement.managedtest.repository;

import com.placement.managedtest.entity.ManagedTestAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ManagedTestAssignmentRepository extends JpaRepository<ManagedTestAssignment, Long> {

    boolean existsByTestIdAndStudentIdAndActiveTrue(Long testId, Long studentId);

    List<ManagedTestAssignment> findByStudentIdAndActiveTrue(Long studentId);

    Page<ManagedTestAssignment> findByTestIdAndActiveTrue(Long testId, Pageable pageable);

    /** Unfiltered version, used when the admin UI asks to see revoked assignments too - active-
     *  only was the only option before, so a revoked row (and its revokedAt/revokedBy/reason) was
     *  never visible anywhere once unassigned. */
    Page<ManagedTestAssignment> findByTestId(Long testId, Pageable pageable);

    @Query("select a.student.id from ManagedTestAssignment a where a.test.id = :testId and a.active = true")
    List<Long> findStudentIdsByTestId(@Param("testId") Long testId);

    long countByTestIdAndActiveTrue(Long testId);
}