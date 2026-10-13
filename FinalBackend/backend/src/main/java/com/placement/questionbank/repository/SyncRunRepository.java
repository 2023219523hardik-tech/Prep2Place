package com.placement.questionbank.repository;

import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.SyncRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SyncRunRepository extends JpaRepository<SyncRun, Long> {
    List<SyncRun> findTop20BySourceOrderByStartedAtDesc(QuestionSource source);

    List<SyncRun> findTop50ByOrderByStartedAtDesc();
}
