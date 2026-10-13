package com.placement.jobs.repository;

import com.placement.jobs.entity.HiringRound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HiringRoundRepository extends JpaRepository<HiringRound, Long> {
    List<HiringRound> findByJobIdOrderByRoundOrderAsc(Long jobId);
    void deleteByJobId(Long jobId);
    long countByJobId(Long jobId);
}
