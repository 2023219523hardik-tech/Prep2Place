package com.placement.questionbank.repository;

import com.placement.entity.Difficulty;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TechnicalMcqQuestionRepository extends JpaRepository<TechnicalMcqQuestion, Long> {

    Optional<TechnicalMcqQuestion> findBySourceRef(String sourceRef);

    /**
     * Admin picker search. Every filter is optional and null-tolerant so the UI can send a partial
     * filter set without the query needing per-combination variants.
     */
    @Query("""
        select q from TechnicalMcqQuestion q
        where q.active = true
          and (:category is null or q.category = :category)
          and (:difficulty is null or q.difficulty = :difficulty)
          and (:topic is null or lower(q.topic) = lower(cast(:topic as string)))
          and (:subtopic is null or lower(q.subtopic) = lower(cast(:subtopic as string)))
          and (:search is null or lower(q.questionText) like lower(concat('%', cast(:search as string), '%')))
        """)
    Page<TechnicalMcqQuestion> search(@Param("category") TechnicalCategory category,
                                      @Param("difficulty") Difficulty difficulty,
                                      @Param("topic") String topic,
                                      @Param("subtopic") String subtopic,
                                      @Param("search") String search,
                                      Pageable pageable);

    /** Candidate pool for the auto-selection rules. Ordering is applied in the service. */
    @Query("""
        select q from TechnicalMcqQuestion q
        where q.active = true
          and (:category is null or q.category = :category)
          and (:difficulty is null or q.difficulty = :difficulty)
        """)
    List<TechnicalMcqQuestion> findPool(@Param("category") TechnicalCategory category,
                                        @Param("difficulty") Difficulty difficulty);

    long countByActiveTrue();

    boolean existsByQuestionText(String questionText);

    @Query("select q.category as category, count(q) as cnt from TechnicalMcqQuestion q where q.active = true group by q.category")
    List<Object[]> countGroupedByCategory();
}
