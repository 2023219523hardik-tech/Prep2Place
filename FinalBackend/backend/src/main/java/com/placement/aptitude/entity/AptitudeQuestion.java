package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "aptitude_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AptitudeQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 1000, nullable = false)
    private String text;

    private String topic; // Quant, Logical, Verbal, Data Interpretation

    @Enumerated(EnumType.STRING)
    private Difficulty difficulty;

    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;

    /** A, B, C or D */
    private String correctOption;

    @Column(length = 1000)
    private String explanation;

    /** Links this MCQ to its entry in the unified Question Intelligence bank
     *  (com.placement.questionbank.entity.CanonicalQuestion), domain=APTITUDE. Nullable. */
    private Long canonicalQuestionId;

    /** Soft-delete flag (added in V8__aptitude_question_active_flag.sql). aptitude_attempt.question_id
     *  is a non-nullable FK with no ON DELETE clause, so a hard delete of a question any student has
     *  attempted fails with a DB constraint violation - archiving is the safe default; see
     *  AdminService.archiveAptitudeQuestion / deleteAptitudeQuestionPermanently.
     *  @Builder.Default matters here: without it, every existing AptitudeQuestion.builder() call
     *  site (the seed loader included) would silently build active=false via Lombok's normal
     *  zero-value default, archiving every seeded question on the very first startup. */
    @Builder.Default
    private boolean active = true;
}