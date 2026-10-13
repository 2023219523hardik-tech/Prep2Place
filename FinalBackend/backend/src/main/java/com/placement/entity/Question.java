package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 2000, nullable = false)
    private String text;

    @Enumerated(EnumType.STRING)
    private QuestionCategory category;

    @Enumerated(EnumType.STRING)
    private Difficulty difficulty;

    @ManyToOne
    @JoinColumn(name = "role_id")
    private JobRole role;

    /** Keywords/model-answer points used by the rule-based evaluator, comma separated */
    @Column(length = 1000)
    private String expectedKeywords;

    @Builder.Default
    private boolean published = true;

    /** Set only for category=DSA questions materialized from the canonical question bank
     *  (com.placement.questionbank.entity.CanonicalQuestion, domain=CODING). Lets the interview
     *  engine draw DSA/coding questions from the same centralized bank Coding Mock Tests use,
     *  instead of maintaining a separate hand-written DSA question set. Null for ordinary
     *  TECHNICAL/HR/COMMUNICATION/INTERVIEW-category questions. */
    private Long canonicalQuestionId;
}
