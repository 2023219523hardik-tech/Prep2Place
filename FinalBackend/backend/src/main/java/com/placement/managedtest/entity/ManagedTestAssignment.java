package com.placement.managedtest.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * An explicit test -> student assignment. Optional: a UNIVERSITY_TEST can instead target a cohort
 * via ManagedTest.organizationName/branch/graduationYear, in which case eligibility is computed
 * from StudentProfile. Explicit rows always win and are what the "Assign" admin action writes.
 */
@Entity
@Table(name = "managed_test_assignment",
        uniqueConstraints = @UniqueConstraint(name = "uk_mt_assignment", columnNames = {"test_id", "student_id"}),
        indexes = {
                @Index(name = "idx_mt_assignment_student", columnList = "student_id"),
                @Index(name = "idx_mt_assignment_test", columnList = "test_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTestAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_id", nullable = false)
    private ManagedTest test;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Builder.Default
    private boolean active = true;

    /** Set together in ManagedTestAdminService.unassign() - null means never revoked. Added so an
     *  admin override is traceable (who revoked, when, why), without changing the existing
     *  active-flag revoke mechanism itself, which already correctly preserves the row rather than
     *  deleting it. */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by_id")
    private User revokedBy;

    @Column(length = 500)
    private String reason;

    @PrePersist
    void onCreate() {
        if (assignedAt == null) assignedAt = Instant.now();
    }
}