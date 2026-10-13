package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "project_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private StudentProfile profile;

    private String title;

    @Column(length = 2000)
    private String description;

    private String techStack;
    private String link;
}
