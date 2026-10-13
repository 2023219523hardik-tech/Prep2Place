package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "proctoring_incident")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctoringIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String sessionId;

    private Long userId;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(length = 2000)
    private String details;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Builder.Default
    private Integer severity = 1;
}
