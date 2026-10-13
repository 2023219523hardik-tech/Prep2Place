package com.placement.repository;

import com.placement.entity.ProctoringIncident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ProctoringIncidentRepository extends JpaRepository<ProctoringIncident, Long> {

    List<ProctoringIncident> findBySessionIdOrderByTimestampDesc(String sessionId);

    Optional<ProctoringIncident> findFirstBySessionIdAndTypeAndTimestampAfter(String sessionId, String type, LocalDateTime after);

    Page<ProctoringIncident> findAllByOrderByTimestampDesc(Pageable pageable);

    long countByTimestampAfter(LocalDateTime after);
}
