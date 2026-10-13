package com.placement.jobs.repository;

import com.placement.jobs.entity.CandidateReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CandidateReminderRepository extends JpaRepository<CandidateReminder, Long> {

    List<CandidateReminder> findByStatusAndScheduledForLessThanEqual(String status, LocalDateTime cutoff);

    List<CandidateReminder> findByRoundIdAndStatus(Long roundId, String status);

    boolean existsByApplicationIdAndRoundIdAndReminderType(Long applicationId, Long roundId, String reminderType);

    List<CandidateReminder> findByApplicationId(Long applicationId);
}
