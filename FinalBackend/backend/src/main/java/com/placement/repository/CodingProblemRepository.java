package com.placement.repository;

import com.placement.entity.CodingProblem;
import com.placement.entity.Difficulty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CodingProblemRepository extends JpaRepository<CodingProblem, Long> {
    Optional<CodingProblem> findByCanonicalQuestionId(Long canonicalQuestionId);
    List<CodingProblem> findByCanonicalQuestionIdIsNull();
    Optional<CodingProblem> findBySourceQuestionId(String sourceQuestionId);
    List<CodingProblem> findBySourceQuestionIdIn(java.util.Collection<String> sourceQuestionIds);
    List<CodingProblem> findBySourceQuestionIdIsNotNullOrderByTitleAsc();
    boolean existsBySourceQuestionId(String sourceQuestionId);

    /** Backs the student-facing GET /api/coding/problems (CodingService.listProblems), replacing
     *  the old sourceQuestionId-based filter - see the "active" field's javadoc on CodingProblem
     *  for why that filter was wrong. */
    List<CodingProblem> findByActiveTrueOrderByTitleAsc();

    /**
     * Returns strictly active DSA problems, excluding SQL and DataFrame questions.
     */
    @Query("""
        SELECT p FROM CodingProblem p
        WHERE p.active = true
          AND (p.category IS NULL OR (UPPER(p.category) != 'SQL' AND UPPER(p.category) != 'DATAFRAME'))
          AND (p.executionMode IS NULL OR (p.executionMode != com.placement.entity.ExecutionMode.SQL AND p.executionMode != com.placement.entity.ExecutionMode.DATAFRAME))
        ORDER BY p.title ASC
    """)
    List<CodingProblem> findActiveDsaProblems();

    Optional<CodingProblem> findFirstByTitleIgnoreCase(String title);

    /** Admin search: "active" is nullable/null-tolerant like the rest of this query, since the
     *  admin picker needs to find archived problems too (to review/reactivate them). */
    @Query("""
        select p from CodingProblem p
        where (:topic is null or lower(p.topic) = lower(cast(:topic as string)))
          and (:difficulty is null or p.difficulty = :difficulty)
          and (:active is null or p.active = :active)
          and (:search is null or lower(p.title) like lower(concat('%', cast(:search as string), '%')))
        """)
    Page<CodingProblem> search(@Param("topic") String topic,
                                @Param("difficulty") Difficulty difficulty,
                                @Param("active") Boolean active,
                                @Param("search") String search,
                                Pageable pageable);
}