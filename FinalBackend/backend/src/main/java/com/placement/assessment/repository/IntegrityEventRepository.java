package com.placement.assessment.repository;

import com.placement.assessment.entity.IntegrityEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * UPDATED: the existing two methods are unchanged; everything below is additive and scoped by
 * attemptKind so managed-test violations and legacy assessment violations never bleed into each
 * other's counts.
 */
public interface IntegrityEventRepository extends JpaRepository<IntegrityEvent, Long> {

    List<IntegrityEvent> findByAttemptIdOrderByOccurredAtAsc(Long attemptId);

    long countByAttemptId(Long attemptId);

    // ---- managed-test aware queries ----

    List<IntegrityEvent> findByAttemptKindAndAttemptIdOrderByOccurredAtAsc(
            IntegrityEvent.AttemptKind attemptKind, Long attemptId);

    long countByAttemptKindAndAttemptId(IntegrityEvent.AttemptKind attemptKind, Long attemptId);

    long countByAttemptKind(IntegrityEvent.AttemptKind attemptKind);

    @Query("""
        select e from IntegrityEvent e
        where e.attemptKind = :kind
        order by e.occurredAt desc
        """)
    List<IntegrityEvent> findRecent(@Param("kind") IntegrityEvent.AttemptKind kind, Pageable pageable);

    @Query("""
        select e.attemptId, count(e) from IntegrityEvent e
        where e.attemptKind = :kind and e.attemptId in :attemptIds
        group by e.attemptId
        """)
    List<Object[]> countGroupedByAttempt(@Param("kind") IntegrityEvent.AttemptKind kind,
                                         @Param("attemptIds") List<Long> attemptIds);
}
