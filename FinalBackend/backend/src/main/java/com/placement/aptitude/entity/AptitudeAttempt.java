package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "aptitude_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AptitudeAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne
    @JoinColumn(name = "question_id", nullable = false)
    private AptitudeQuestion question;

    private String selectedOption;

    private boolean correct;

    @Builder.Default
    private LocalDateTime attemptedAt = LocalDateTime.now();
}
