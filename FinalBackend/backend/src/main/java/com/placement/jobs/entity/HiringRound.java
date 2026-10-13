package com.placement.jobs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "hiring_round")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HiringRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private JobOpportunity job;

    @Column(nullable = false)
    private Integer roundOrder;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private HiringRoundType roundType;

    /** Duration in minutes, e.g. 60 min */
    private Integer durationMinutes;

    /** Passing percentage or score threshold, e.g. 70.0 */
    private Double passingScore;

    /** Weightage in percentage, e.g. 25.0 */
    private Double weightage;

    @Builder.Default
    @Column(nullable = false)
    private Integer maxAttempts = 1;

    @Builder.Default
    @Column(nullable = false)
    private boolean repeatable = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean autoUnlock = true;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 50)
    private RoundManagementMode managementMode = RoundManagementMode.AUTOMATIC;

    /** JSON configuration for questions, pool categories, instructions */
    @Column(columnDefinition = "TEXT")
    private String assessmentConfig;

    /** Round lifecycle status: DRAFT, SCHEDULED, READY, LIVE, PAUSED, COMPLETED, CLOSED, CANCELLED */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(length = 50)
    private RoundLifecycleStatus roundStatus = RoundLifecycleStatus.DRAFT;

    private LocalDate startDate;
    private LocalTime startTime;
    private LocalDate endDate;
    private LocalTime endTime;

    @Builder.Default
    @Column(length = 50)
    private String timezone = "Asia/Kolkata";

    @Builder.Default
    @Column(nullable = false)
    private boolean isActivated = false;

    /** JSON configuration for proctoring checks (webcam, mic, screen share, full screen, tab switches, Safe Exam Browser) */
    @Column(columnDefinition = "TEXT")
    private String proctoringConfig;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (managementMode == null) managementMode = RoundManagementMode.AUTOMATIC;
        if (roundStatus == null) roundStatus = RoundLifecycleStatus.DRAFT;
        if (timezone == null) timezone = "Asia/Kolkata";
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
