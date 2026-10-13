package com.placement.questionbank.repository;

import com.placement.entity.Difficulty;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.QuestionAvailabilityState;
import com.placement.questionbank.entity.QuestionDomain;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CanonicalQuestionRepository extends JpaRepository<CanonicalQuestion, Long> {

    Optional<CanonicalQuestion> findByNormalizedTitleKeyAndActiveTrue(String normalizedTitleKey);

    List<CanonicalQuestion> findByAvailabilityStateAndActiveTrue(QuestionAvailabilityState state);

    // NOTE: bare lower(:param) breaks on PostgreSQL when the parameter is NULL (Hibernate binds it untyped -> "function lower(bytea) does not exist").
    //       The explicit cast(... as string) gives the parameter a type, so optional filters can be null.
    @Query("""
        select q from CanonicalQuestion q
        where q.active = true
          and q.availabilityState in (com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE,
                                       com.placement.questionbank.entity.QuestionAvailabilityState.PENDING_REVIEW)
        """)
    List<CanonicalQuestion> findAllActiveForDedup();

    List<CanonicalQuestion> findByDomainAndAvailabilityStateAndActiveTrue(QuestionDomain domain, QuestionAvailabilityState state);

    @Query("""
        select q from CanonicalQuestion q
        where q.active = true
          and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
          and (:domain is null or q.domain = :domain)
          and (:difficulty is null or q.difficulty = :difficulty)
          and (:topic is null or lower(cast(:topic as string)) in (select lower(t) from q.topics t))
          and (:company is null or lower(cast(:company as string)) in (select lower(c) from q.companies c))
          and (:language is null or lower(cast(:language as string)) in (select lower(l) from q.supportedLanguages l))
          and (:searchText is null or lower(q.canonicalTitle) like lower(concat('%', cast(:searchText as string), '%')))
        """)
    Page<CanonicalQuestion> search(@Param("domain") QuestionDomain domain,
                                    @Param("difficulty") Difficulty difficulty,
                                    @Param("topic") String topic,
                                    @Param("company") String company,
                                    @Param("language") String language,
                                    @Param("searchText") String searchText,
                                    Pageable pageable);

    @Query("""
        select q from CanonicalQuestion q
        where q.active = true
          and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
          and (:domain is null or q.domain = :domain)
          and (:difficulty is null or q.difficulty = :difficulty)
        """)
    List<CanonicalQuestion> findAvailableCandidatePool(@Param("domain") QuestionDomain domain, @Param("difficulty") Difficulty difficulty);

    /** Section 5: lets a profile scope itself to a subset of topics (e.g. an aptitude test that's
     *  Quant-only) instead of drawing from the entire domain - :topics is matched case-insensitively
     *  against any of the question's tagged topics. */
    @Query("""
        select distinct q from CanonicalQuestion q join q.topics t
        where q.active = true
          and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
          and (:domain is null or q.domain = :domain)
          and (:difficulty is null or q.difficulty = :difficulty)
          and lower(t) in :topicsLower
        """)
    List<CanonicalQuestion> findAvailableCandidatePoolByTopics(@Param("domain") QuestionDomain domain,
                                                                 @Param("difficulty") Difficulty difficulty,
                                                                 @Param("topicsLower") List<String> topicsLower);

    long countByAvailabilityState(QuestionAvailabilityState state);

    /** Section 5 (Company Vault) - one row per distinct company with its total available question
     *  count, for the landing grid. Deliberately NOT grouped by lower(c): companies are seeded in
     *  a single consistent casing (see leetcode.json/gfg.json), so this stays a single group-by
     *  rather than a second normalization pass the ingested data doesn't need. */
    @Query("""
        select c as name, count(q) as cnt
        from CanonicalQuestion q join q.companies c
        where q.active = true and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
        group by c
        """)
    List<Object[]> countQuestionsGroupedByCompany();

    /** Section 5 (Company Vault) - difficulty breakdown for one company's detail header. */
    @Query("""
        select q.difficulty as difficulty, count(q) as cnt
        from CanonicalQuestion q join q.companies c
        where q.active = true and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
          and lower(c) = lower(cast(:company as string))
        group by q.difficulty
        """)
    List<Object[]> countByDifficultyForCompany(@Param("company") String company);

    /** Section 5 (Company Vault) - the actual question list for one company, ordered so the
     *  free/locked split is deterministic (not "whatever order Postgres feels like today"). */
    @Query("""
        select distinct q from CanonicalQuestion q join q.companies c
        where q.active = true and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
          and lower(c) = lower(cast(:company as string))
        order by q.difficulty asc, q.canonicalTitle asc
        """)
    List<CanonicalQuestion> findByCompanyOrdered(@Param("company") String company);
}
