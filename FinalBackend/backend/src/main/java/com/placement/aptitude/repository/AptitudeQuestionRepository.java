package com.placement.repository;

import com.placement.entity.AptitudeQuestion;
import com.placement.entity.Difficulty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AptitudeQuestionRepository extends JpaRepository<AptitudeQuestion, Long> {

    Optional<AptitudeQuestion> findByCanonicalQuestionId(Long canonicalQuestionId);

    List<AptitudeQuestion> findByCanonicalQuestionIdIsNull();

    List<AptitudeQuestion> findByActiveTrue();

    @Query("select count(q) > 0 from AptitudeQuestion q where lower(q.text) = lower(:text)")
    boolean existsByText(@Param("text") String text);

    @Query("""
        select q from AptitudeQuestion q
        where q.active = :active
          and (:topic is null or lower(q.topic) = lower(cast(:topic as string)))
          and (:difficulty is null or q.difficulty = :difficulty)
          and (:search is null or lower(q.text) like lower(concat('%', cast(:search as string), '%')))
        """)
    Page<AptitudeQuestion> search(
            @Param("topic") String topic,
            @Param("difficulty") Difficulty difficulty,
            @Param("active") boolean active,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
        select q from AptitudeQuestion q
        where (:topic is null or lower(q.topic) = lower(cast(:topic as string)))
          and (:difficulty is null or q.difficulty = :difficulty)
        """)
    List<AptitudeQuestion> findPool(
            @Param("topic") String topic,
            @Param("difficulty") Difficulty difficulty
    );

    @Query("""
        select distinct q.topic
        from AptitudeQuestion q
        where q.topic is not null
        order by q.topic
        """)
    List<String> findDistinctTopics();
}