package com.placement.jobs.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "round_attempt", uniqueConstraints = {
        @UniqueConstraint(name = "uk_app_round_attempt", columnNames = {"application_id", "round_id", "attempt_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoundAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false)
    private HiringRound round;

    @Builder.Default
    @Column(nullable = false)
    private Integer attemptNumber = 1;

    /** Score achieved in this attempt (percentage or points) */
    private Double score;

    /** Whether the candidate passed this round threshold */
    private Boolean passed;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 50)
    private RoundAttemptStatus status = RoundAttemptStatus.NOT_STARTED;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private LocalDateTime interviewScheduledAt;

    @Column(length = 500)
    private String interviewerMeetingLink;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluated_by")
    private User evaluatedBy;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = RoundAttemptStatus.NOT_STARTED;
        if (attemptNumber == null) attemptNumber = 1;
    }
}
