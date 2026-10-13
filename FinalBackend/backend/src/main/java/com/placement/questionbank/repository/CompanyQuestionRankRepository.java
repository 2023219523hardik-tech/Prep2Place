package com.placement.questionbank.repository;

import com.placement.questionbank.entity.CompanyQuestionRank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CompanyQuestionRankRepository extends JpaRepository<CompanyQuestionRank, Long> {

    Optional<CompanyQuestionRank> findByCompanyIdAndCanonicalQuestionId(Long companyId, Long canonicalQuestionId);

    long countByCompanyId(Long companyId);

    /** Ranked question list for one company's Company Vault page, most-frequently-asked first.
     *  Postgres' default ORDER BY behaviour already puts NULLs last for ASC, so a row with no
     *  rank (source sheet didn't provide one) sorts after every ranked row instead of first. */
    @Query("""
        select r from CompanyQuestionRank r
        join fetch r.canonicalQuestion q
        where lower(r.company.slug) = lower(cast(:slug as string))
          and q.active = true
          and q.availabilityState = com.placement.questionbank.entity.QuestionAvailabilityState.AVAILABLE
        order by r.rank asc, q.canonicalTitle asc
        """)
    List<CompanyQuestionRank> findRankedByCompanySlug(@Param("slug") String slug);
}
