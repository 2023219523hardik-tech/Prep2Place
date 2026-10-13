package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "skill")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private StudentProfile profile;

    @Column(nullable = false)
    private String name;

    /** 1 (beginner) - 5 (expert), self-rated, adjusted by practice performance */
    @Builder.Default
    private Integer proficiency = 1;
}
