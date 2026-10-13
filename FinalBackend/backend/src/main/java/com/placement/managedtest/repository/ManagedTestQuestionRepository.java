package com.placement.managedtest.repository;

import com.placement.managedtest.entity.ManagedTestQuestion;
import com.placement.managedtest.entity.QuestionSourceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ManagedTestQuestionRepository extends JpaRepository<ManagedTestQuestion, Long> {

    List<ManagedTestQuestion> findBySectionIdOrderByDisplayOrderAsc(Long sectionId);

    List<ManagedTestQuestion> findBySectionTestId(Long testId);

    /** Duplicate guard: the same bank question must not appear twice in one test. */
    @Query("""
        select count(q) from ManagedTestQuestion q
        where q.section.test.id = :testId and q.sourceType = :sourceType and q.sourceQuestionId = :sourceQuestionId
        """)
    long countInTestBySource(@Param("testId") Long testId,
                             @Param("sourceType") QuestionSourceType sourceType,
                             @Param("sourceQuestionId") Long sourceQuestionId);

    @Query("""
        select q.sourceQuestionId from ManagedTestQuestion q
        where q.section.test.id = :testId and q.sourceQuestionId is not null
        """)
    List<Long> findSourceIdsInTest(@Param("testId") Long testId);

    /**
     * "Used in N tests" counter for the picker. Counts distinct tests, not questions, so re-using a
     * question in two sections of the same test still reads as one.
     */
    @Query("""
        select q.sourceQuestionId as sourceId, count(distinct q.section.test.id) as usageCount
        from ManagedTestQuestion q
        where q.sourceType = :sourceType and q.sourceQuestionId in :sourceIds
        group by q.sourceQuestionId
        """)
    List<Object[]> countUsageBySourceIds(@Param("sourceType") QuestionSourceType sourceType,
                                         @Param("sourceIds") List<Long> sourceIds);

    @Query("select coalesce(sum(q.marks), 0) from ManagedTestQuestion q where q.section.test.id = :testId")
    double sumMarksForTest(@Param("testId") Long testId);

    long countBySectionId(Long sectionId);
}
