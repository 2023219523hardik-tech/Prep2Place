package com.placement.jobs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "candidate_reminder", uniqueConstraints = {
        @UniqueConstraint(name = "uk_reminder_app_round_type", columnNames = {"application_id", "round_id", "reminder_type"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false)
    private HiringRound round;

    @Column(name = "reminder_type", nullable = false, length = 40)
    private String reminderType; // SEVENTY_TWO_HOURS | TWENTY_FOUR_HOURS

    @Column(nullable = false)
    private LocalDateTime scheduledFor;

    private LocalDateTime sentAt;

    @Builder.Default
    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING | SENT | CANCELLED | FAILED

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = "PENDING";
    }
}
