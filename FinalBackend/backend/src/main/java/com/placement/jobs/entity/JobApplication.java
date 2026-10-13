package com.placement.jobs.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A student's application to a JobOpportunity.
 */
@Entity
@Table(name = "job_application", uniqueConstraints = {
        @UniqueConstraint(name = "uk_job_applicant", columnNames = {"job_id", "applicant_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "job_id", nullable = false)
    private JobOpportunity job;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private JobApplicationStatus status = JobApplicationStatus.APPLIED;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime appliedAt = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String resumeText;

    @Column(length = 4000)
    private String coverNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "current_round_id")
    private HiringRound currentRound;

    private Double overallScore;

    @Column(length = 50)
    private String finalDecision;

    /** ATS compatibility score (0.0 - 100.0) */
    private Double atsScore;

    /** ATS parsing status: PENDING | PARSED | FAILED | MANUAL_REVIEW */
    @Builder.Default
    @Column(length = 50)
    private String atsParsingStatus = "PARSED";

    /** Academic & mandatory eligibility check flag */
    @Builder.Default
    @Column(nullable = false)
    private boolean eligibilityPassed = true;

    /** Reason for failure if mandatory eligibility failed */
    @Column(columnDefinition = "TEXT")
    private String eligibilityFailureReason;

    /** Detailed ATS breakdown JSON */
    @Column(columnDefinition = "TEXT")
    private String atsScoreBreakdown;

    /** Recruiter manual review notes and override logs */
    @Column(columnDefinition = "TEXT")
    private String recruiterAuditNotes;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.appliedAt == null) {
            this.appliedAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = JobApplicationStatus.APPLIED;
        }
        if (this.atsParsingStatus == null) {
            this.atsParsingStatus = "PARSED";
        }
        if (this.updatedAt == null) {
            this.updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
