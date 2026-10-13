package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

/** Single-row table holding admin-configurable weighted-scoring model. Percentages should sum to 100. */
@Entity
@Table(name = "score_weight_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScoreWeightConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Builder.Default private Double correctnessWeight = 40.0;
    @Builder.Default private Double clarityWeight = 20.0;
    @Builder.Default private Double confidenceWeight = 15.0;
    @Builder.Default private Double structureWeight = 15.0;
    @Builder.Default private Double depthWeight = 10.0;

    // Readiness category weights
    @Builder.Default private Double dsaWeight = 20.0;
    @Builder.Default private Double aptitudeWeight = 15.0;
    @Builder.Default private Double technicalWeight = 15.0;
    @Builder.Default private Double communicationWeight = 10.0;
    @Builder.Default private Double interviewWeight = 25.0;
    @Builder.Default private Double projectsWeight = 10.0;
    @Builder.Default private Double academicsWeight = 5.0;
}
