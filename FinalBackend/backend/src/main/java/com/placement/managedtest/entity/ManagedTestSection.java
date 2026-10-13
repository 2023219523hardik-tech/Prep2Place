package com.placement.managedtest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * One section of a {@link ManagedTest}. Sections are ordered, independently timed (optionally) and
 * carry their own marking rules, which override the test-level defaults.
 */
@Entity
@Table(name = "managed_test_section", indexes = {
        @Index(name = "idx_mt_section_test", columnList = "test_id"),
        @Index(name = "idx_mt_section_order", columnList = "test_id,display_order")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTestSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_id", nullable = false)
    @JsonIgnore
    private ManagedTest test;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "section_type", nullable = false, length = 30)
    private SectionType sectionType;

    @Column(length = 1000)
    private String instructions;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    /**
     * How many questions the candidate is served. For MANUAL sections this must equal the number of
     * attached questions; for RANDOM/HYBRID it is the target the selection rules fill up to.
     */
    @Builder.Default
    private int questionCount = 0;

    /** 0 = no section timer (the overall test timer applies). */
    @Builder.Default
    private int durationMinutes = 0;

    /** Default marks per question in this section; a question may override it. */
    @Builder.Default
    private double marksPerQuestion = 1d;

    @Builder.Default
    private double negativeMarks = 0d;

    /** Optional section-level pass bar, reported separately from the overall result. */
    private Double passingPercentage;

    @Builder.Default
    private boolean mandatory = true;

    @Builder.Default
    private boolean randomizeQuestions = false;

    @Builder.Default
    private boolean randomizeOptions = false;

    /** When false the candidate cannot return to this section once they leave it. */
    @Builder.Default
    private boolean allowBackNavigation = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "selection_strategy", nullable = false, length = 20)
    @Builder.Default
    private SelectionStrategy selectionStrategy = SelectionStrategy.MANUAL;

    /**
     * Auto-selection rules for RANDOM / FIXED / HYBRID sections. Shape:
     * <pre>
     * {
     *   "sourceType": "TECHNICAL_MCQ",
     *   "difficulty": { "EASY": 3, "MEDIUM": 5, "HARD": 2 },
     *   "categories": { "OOPS": 5, "OS": 5, "CN": 5, "DBMS": 5 },
     *   "topics": ["Arrays", "Trees"],
     *   "companies": ["Amazon"]
     * }
     * </pre>
     * difficulty and categories counts are both optional; whichever is present is honoured, and any
     * shortfall is topped up from the wider pool so a section is never silently short of questions.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "selection_rules", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> selectionRules = new java.util.HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<ManagedTestQuestion> questions = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    @Transient
    public List<ManagedTestQuestion> orderedQuestions() {
        List<ManagedTestQuestion> copy = new ArrayList<>(questions);
        copy.sort(Comparator.comparingInt(ManagedTestQuestion::getDisplayOrder));
        return copy;
    }

    /** Sum of the marks actually attached, which is what the validator compares against. */
    @Transient
    public double attachedMarks() {
        return questions.stream().mapToDouble(ManagedTestQuestion::getMarks).sum();
    }
}
