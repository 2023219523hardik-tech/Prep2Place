package com.placement.managedtest.repository;

import com.placement.managedtest.entity.ManagedTest;
import com.placement.managedtest.entity.TestStatus;
import com.placement.managedtest.entity.TestType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ManagedTestRepository extends JpaRepository<ManagedTest, Long> {

    @Query("""
        select t from ManagedTest t
        where t.active = true
          and (:status is null or t.status = :status)
          and (:testType is null or t.testType = :testType)
          and (:search is null or lower(t.name) like lower(concat('%', cast(:search as string), '%'))
               or lower(coalesce(t.organizationName, '')) like lower(concat('%', cast(:search as string), '%')))
        """)
    Page<ManagedTest> search(@Param("status") TestStatus status,
                             @Param("testType") TestType testType,
                             @Param("search") String search,
                             Pageable pageable);

    /** Loads sections eagerly for the builder/preview screens, which always need the whole tree. */
    @EntityGraph(attributePaths = {"sections"})
    Optional<ManagedTest> findWithSectionsById(Long id);

    List<ManagedTest> findByStatusInAndActiveTrue(List<TestStatus> statuses);

    long countByStatusAndActiveTrue(TestStatus status);

    long countByTestTypeAndActiveTrue(TestType testType);

    long countByActiveTrue();

    /**
     * Cohort-targeted tests a student is eligible for even without an explicit assignment row.
     * A null targeting field on the test means "any" for that dimension.
     */
    @Query("""
        select t from ManagedTest t
        where t.active = true
          and t.status in (com.placement.managedtest.entity.TestStatus.PUBLISHED,
                           com.placement.managedtest.entity.TestStatus.SCHEDULED,
                           com.placement.managedtest.entity.TestStatus.ACTIVE)
          and (t.startsAt is null or t.startsAt <= :now)
          and (t.endsAt is null or t.endsAt >= :now)
          and (t.organizationName is null or lower(t.organizationName) = lower(coalesce(:college, '~none~')))
          and (t.branch is null or lower(t.branch) = lower(coalesce(:branch, '~none~')))
          and (t.graduationYear is null or t.graduationYear = :graduationYear)
        """)
    List<ManagedTest> findCohortTargeted(@Param("now") Instant now,
                                         @Param("college") String college,
                                         @Param("branch") String branch,
                                         @Param("graduationYear") Integer graduationYear);
}
