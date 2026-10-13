package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "problem_constraint")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProblemConstraint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private CodingProblem problem;

    @Column(nullable = false)
    private Integer ordinal;

    @Column(nullable = false, length = 1000)
    private String text;
}
