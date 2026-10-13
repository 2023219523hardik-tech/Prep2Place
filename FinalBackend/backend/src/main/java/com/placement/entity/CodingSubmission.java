package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "coding_submission")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodingSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne
    @JoinColumn(name = "problem_id", nullable = false)
    private CodingProblem problem;

    @Column(length = 10000)
    private String code;

    private String language;

    /** PASSED / FAILED / PARTIAL — result of comparing output against expected sample output */
    private String verdict;

    private Integer score; // 0-100

    @Builder.Default
    private LocalDateTime submittedAt = LocalDateTime.now();

    /** Full RunCodeResponse (status/passed/total/per-test results with actual vs expected output)
     *  captured at submit time, so evidence-based reporting can show exactly what failed instead of
     *  just a verdict string or re-deriving (possibly non-reproducible) results later. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private java.util.Map<String, Object> executionDetails;

    /** Set when this submission happened inside a proctored AssessmentAttempt (mock test); null for
     *  free-practice submissions made outside any timed assessment. */
    private Long attemptId;

    /** Index of the question within the attempt's locked question list, for ordering/navigation. */
    private Integer attemptQuestionIndex;
}
