package com.placement.service;

import com.placement.entity.AuditLogEntry;
import com.placement.entity.User;
import com.placement.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single write path for audit logging (see AuditLogEntry's class javadoc for why one generic
 * table rather than per-feature ones). Deliberately a thin, cheap call - record() never throws:
 * an audit-log write failing must never break the admin action it is recording, so any exception
 * is swallowed and logged rather than propagated. Call this from any admin service after a mutation
 * succeeds, not before - an audit entry for an action that then failed and rolled back would be
 * misleading.
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository repository;

    public void record(User admin, String action, String entityType, Long entityId, String details) {
        try {
            repository.save(AuditLogEntry.builder()
                    .admin(admin)
                    .adminName(admin == null ? "system" : admin.getFullName())
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .details(details)
                    .build());
        } catch (Exception e) {
            // Never let a logging failure break the admin action it describes.
            org.slf4j.LoggerFactory.getLogger(AuditLogService.class)
                    .warn("Failed to write audit log entry: action={} entityType={} entityId={}", action, entityType, entityId, e);
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLogEntry> search(String action, String entityType, Pageable pageable) {
        return repository.search(action, entityType, pageable);
    }
}