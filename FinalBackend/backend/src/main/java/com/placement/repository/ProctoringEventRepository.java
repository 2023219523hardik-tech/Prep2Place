package com.placement.repository;

import com.placement.entity.ProctoringEvent;
import com.placement.entity.ProctoringEventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ProctoringEventRepository extends JpaRepository<ProctoringEvent, Long> {
    List<ProctoringEvent> findBySessionIdOrderByOccurredAtAsc(Long sessionId);

    /** Used for the reading-detection heuristic: how many eye-roaming signals fired for this
     *  session in a recent rolling window, to distinguish a brief glance from sustained diversion. */
    long countBySessionIdAndEventTypeAndOccurredAtAfter(Long sessionId, ProctoringEventType eventType, LocalDateTime after);

    /** Used by the evidence retention purge job. */
    List<ProctoringEvent> findByOccurredAtBeforeAndFrameCaptureIsNotNull(LocalDateTime cutoff);
}
