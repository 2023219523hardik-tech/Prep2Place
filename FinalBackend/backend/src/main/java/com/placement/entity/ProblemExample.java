package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "problem_example")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProblemExample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private CodingProblem problem;

    @Column(nullable = false)
    private Integer ordinal;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String input;

    @Column(length = 2000)
    private String output;

    @Column(length = 1000)
    private String explanation;

    @Builder.Default
    private boolean hidden = false;
}
