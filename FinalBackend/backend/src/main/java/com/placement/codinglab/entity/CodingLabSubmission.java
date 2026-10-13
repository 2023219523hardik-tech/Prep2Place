package com.placement.codinglab.entity;

import com.placement.codinglab.model.TestCaseResult;
import com.placement.codinglab.runner.RequirementScorer;
import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

/**
 * One execution: a student-triggered RUN (public tests only, unlimited) or a SUBMIT (public + hidden tests,
 * scored). {@link #testReport} holds EVERY test result including hidden ones (admin-only detail);
 * student-facing DTOs redact hidden test names and messages.
 */
@Entity
@Table(name = "coding_lab_submission")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodingLabSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private CodingAssessment assessment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CodingSubmissionKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CodingSubmissionStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> filesSnapshot = new HashMap<>();

    private int runtimeMs;
    private double memoryMb;

    private int testsTotal;
    private int testsPassed;
    private int testsFailed;

    @Builder.Default
    private double score = 0.0;

    /** Build (compile / bundle / syntax) output when the project did not build. */
    @Column(length = 4000)
    private String compilationError;

    /** Timeout / crash / runner problem description. */
    @Column(length = 4000)
    private String runtimeError;

    /** RUN only: the candidate's own console output + test runner output. Never set for SUBMIT (could reveal hidden tests). */
    @Column(length = 8000)
    private String publicOutput;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Map<String, Object>> testReport = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Map<String, Object>> requirementReport = new ArrayList<>();

    @Builder.Default
    private int aiHintsUsedAtSubmission = 0;

    private Instant submittedAt;

    @PrePersist
    void onCreate() {
        if (submittedAt == null) submittedAt = Instant.now();
    }

    public List<TestCaseResult> cases() {
        List<TestCaseResult> out = new ArrayList<>();
        if (testReport != null) for (Map<String, Object> m : testReport) out.add(TestCaseResult.fromMap(m));
        return out;
    }

    public void setCases(List<TestCaseResult> cases) {
        this.testReport = new ArrayList<>(cases.stream().map(TestCaseResult::toMap).toList());
    }

    public void setRequirements(List<RequirementScorer.RequirementResult> results) {
        this.requirementReport = new ArrayList<>(results.stream().map(RequirementScorer.RequirementResult::toMap).toList());
    }
}
