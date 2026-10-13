package com.placement.jobs.repository;

import com.placement.jobs.entity.RoundAttempt;
import com.placement.jobs.entity.RoundAttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoundAttemptRepository extends JpaRepository<RoundAttempt, Long> {
    List<RoundAttempt> findByApplicationId(Long applicationId);
    int countByApplicationIdAndRoundId(Long applicationId, Long roundId);
    List<RoundAttempt> findByApplicationIdOrderByRoundRoundOrderAscAttemptNumberAsc(Long applicationId);
    Optional<RoundAttempt> findTopByApplicationIdAndRoundIdOrderByAttemptNumberDesc(Long applicationId, Long roundId);
    List<RoundAttempt> findByRoundId(Long roundId);

    @Query("SELECT r FROM RoundAttempt r WHERE ((r.application.job.companyRef IS NOT NULL AND r.application.job.companyRef.id = :companyId) OR LOWER(r.application.job.company) = LOWER(:companyName)) AND r.status IN :statuses ORDER BY r.createdAt DESC")
    List<RoundAttempt> findActiveAttemptsByCompany(@Param("companyId") Long companyId, @Param("companyName") String companyName, @Param("statuses") List<RoundAttemptStatus> statuses);

    @Query("SELECT r FROM RoundAttempt r WHERE ((r.application.job.companyRef IS NOT NULL AND r.application.job.companyRef.id = :companyId) OR LOWER(r.application.job.company) = LOWER(:companyName)) AND r.round.roundType IN (com.placement.jobs.entity.HiringRoundType.AI_INTERVIEW, com.placement.jobs.entity.HiringRoundType.TECHNICAL_INTERVIEW, com.placement.jobs.entity.HiringRoundType.HR_INTERVIEW) ORDER BY r.createdAt DESC")
    List<RoundAttempt> findInterviewsByCompany(@Param("companyId") Long companyId, @Param("companyName") String companyName);

    @Query("SELECT r FROM RoundAttempt r WHERE ((r.application.job.companyRef IS NOT NULL AND r.application.job.companyRef.id = :companyId) OR LOWER(r.application.job.company) = LOWER(:companyName)) AND r.status IN (com.placement.jobs.entity.RoundAttemptStatus.PASSED, com.placement.jobs.entity.RoundAttemptStatus.FAILED, com.placement.jobs.entity.RoundAttemptStatus.COMPLETED, com.placement.jobs.entity.RoundAttemptStatus.EVALUATED) ORDER BY r.completedAt DESC NULLS LAST")
    List<RoundAttempt> findCompletedAttemptsByCompany(@Param("companyId") Long companyId, @Param("companyName") String companyName);
}
