package com.placement.repository;

import com.placement.entity.AuditLogEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, Long> {

    Page<AuditLogEntry> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId, Pageable pageable);

    Page<AuditLogEntry> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);

    @Query("""
        select a from AuditLogEntry a
        where (:action is null or a.action = :action)
          and (:entityType is null or a.entityType = :entityType)
        order by a.createdAt desc
        """)
    Page<AuditLogEntry> search(@Param("action") String action, @Param("entityType") String entityType, Pageable pageable);
}