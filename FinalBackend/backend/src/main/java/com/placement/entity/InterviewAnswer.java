package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_answer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession session;

    @ManyToOne
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(length = 4000)
    private String transcript; // typed answer, or STT output for audio answers

    private boolean fromAudio;

    // Evaluation dimensions (0-100)
    private Double correctness;
    private Double relevance;
    private Double depth;
    private Double clarity;
    private Double grammar;
    private Double confidence; // derived from CV pipeline (mocked) for audio/video answers
    private Double structure;

    private Double weightedScore;

    /** Section 12 speech-delivery analysis: real elapsed time on this answer, client-measured.
     *  Null for typed/legacy answers where this wasn't captured. */
    private Double durationSeconds;

    @Column(length = 2000)
    private String feedback;

    @Builder.Default
    private LocalDateTime answeredAt = LocalDateTime.now();
}
