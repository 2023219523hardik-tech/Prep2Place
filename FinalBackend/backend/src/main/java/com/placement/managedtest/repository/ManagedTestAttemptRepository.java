package com.placement.managedtest.repository;

import com.placement.assessment.entity.AttemptStatus;
import com.placement.managedtest.entity.ManagedTestAttempt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ManagedTestAttemptRepository extends JpaRepository<ManagedTestAttempt, Long> {

    /** Fetch-joins test + student so attempt listings don't fire an N+1 per row. */
    @EntityGraph(attributePaths = {"test", "student"})
    Page<ManagedTestAttempt> findByTestId(Long testId, Pageable pageable);

    @EntityGraph(attributePaths = {"test", "student"})
    Page<ManagedTestAttempt> findByStudentId(Long studentId, Pageable pageable);

    @EntityGraph(attributePaths = {"test", "student"})
    List<ManagedTestAttempt> findByStudentIdOrderByCreatedAtDesc(Long studentId);

    @EntityGraph(attributePaths = {"test", "student"})
    Optional<ManagedTestAttempt> findWithRefsById(Long id);

    /** Backs live monitoring's "active students" list - IN_PROGRESS is the only status that
     *  belongs there; PAUSED/terminal statuses are deliberately excluded so a student who has
     *  finished or been terminated doesn't linger in the "currently taking the test" view. */
    @EntityGraph(attributePaths = {"test", "student"})
    List<ManagedTestAttempt> findByTestIdAndStatus(Long testId, AttemptStatus status);

    /** Live monitoring's dashboard-level "which tests currently have anyone active" list. */
    @Query("select distinct a.test.id from ManagedTestAttempt a where a.status = com.placement.assessment.entity.AttemptStatus.IN_PROGRESS")
    List<Long> findTestIdsWithActiveAttempts();

    List<ManagedTestAttempt> findByTestIdAndStudentId(Long testId, Long studentId);

    Optional<ManagedTestAttempt> findFirstByTestIdAndStudentIdAndStatus(Long testId, Long studentId, AttemptStatus status);

    long countByTestIdAndStudentId(Long testId, Long studentId);

    long countByTestId(Long testId);

    /** Attempts whose server deadline has passed but which were never submitted - the auto-submit sweep. */
    @Query("""
        select a from ManagedTestAttempt a
        where a.status = com.placement.assessment.entity.AttemptStatus.IN_PROGRESS
          and a.serverExpiresAt is not null and a.serverExpiresAt < :now
        """)
    List<ManagedTestAttempt> findExpired(@Param("now") Instant now);

    @Query("""
        select count(a) from ManagedTestAttempt a
        where a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    long countSubmitted();

    @Query("select count(a) from ManagedTestAttempt a where a.createdAt >= :since")
    long countStartedSince(@Param("since") Instant since);

    @Query("select count(a) from ManagedTestAttempt a where a.submittedAt >= :since")
    long countSubmittedSince(@Param("since") Instant since);

    @Query("""
        select avg(a.percentage) from ManagedTestAttempt a
        where a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    Double averagePercentage();

    @Query("""
        select avg(a.accuracy) from ManagedTestAttempt a
        where a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    Double averageAccuracy();

    @Query("""
        select count(a) from ManagedTestAttempt a
        where a.passed = true and a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                                               com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    long countPassed();

    /** Most-attempted tests for the dashboard. Returns [testId, testName, attemptCount, avgPercentage]. */
    @Query("""
        select a.test.id, a.test.name, count(a), avg(a.percentage)
        from ManagedTestAttempt a
        group by a.test.id, a.test.name
        order by count(a) desc
        """)
    List<Object[]> aggregateByTest(Pageable pageable);

    /** Lowest-performing tests: same shape, ordered by average score ascending, submitted only. */
    @Query("""
        select a.test.id, a.test.name, count(a), avg(a.percentage)
        from ManagedTestAttempt a
        where a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        group by a.test.id, a.test.name
        having count(a) > 0
        order by avg(a.percentage) asc
        """)
    List<Object[]> aggregateByTestWorst(Pageable pageable);

    @EntityGraph(attributePaths = {"test", "student"})
    List<ManagedTestAttempt> findTop10ByOrderBySubmittedAtDesc();

    /** Percentile support: how many submitted attempts of this test scored below a given percentage. */
    @Query("""
        select count(a) from ManagedTestAttempt a
        where a.test.id = :testId and a.percentage < :percentage
          and a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    long countBelowPercentage(@Param("testId") Long testId, @Param("percentage") double percentage);

    @Query("""
        select count(a) from ManagedTestAttempt a
        where a.test.id = :testId
          and a.status in (com.placement.assessment.entity.AttemptStatus.SUBMITTED,
                           com.placement.assessment.entity.AttemptStatus.AUTO_SUBMITTED)
        """)
    long countSubmittedForTest(@Param("testId") Long testId);
}