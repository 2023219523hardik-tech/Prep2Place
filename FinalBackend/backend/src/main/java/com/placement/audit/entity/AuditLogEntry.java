package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One row per admin mutation worth auditing (question CRUD, access grant/revoke, test publish,
 * live session view, ...). Deliberately generic rather than a table per feature - see
 * AuditLogService, the single write path every admin action should go through.
 *
 * entityId/entityType are plain strings/longs rather than a polymorphic FK on purpose: an audit
 * row must survive the entity it refers to being later hard-deleted (rare, but the whole point of
 * an audit log is to outlive the thing it describes), so a real foreign key here would be wrong.
 */
@Entity
@Table(name = "audit_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private User admin;

    /** Denormalized at write time so the log entry still reads sensibly even if the admin user is
     *  later deleted or renamed - an audit trail should describe what happened at the time. */
    @Column(name = "admin_name")
    private String adminName;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "entity_type", length = 100)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(length = 2000)
    private String details;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}