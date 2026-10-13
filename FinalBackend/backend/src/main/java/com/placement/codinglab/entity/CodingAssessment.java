package com.placement.codinglab.entity;

import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.model.RequirementSpec;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

/**
 * A reusable practical coding question (Backend / Frontend / ML / AI / GenAI / RAG).
 *
 * <p>What a "proper" question consists of - and what {@code AssessmentContentValidator} enforces:
 * a problem statement, 2-10 <b>requirements</b> (each scored by tests tagged with its id), starter files,
 * public tests ({@code tests/public/}), hidden tests ({@code tests/hidden/}) and a <b>reference solution</b>
 * that is never shown to candidates. It can only be published once the sandbox has verified that the reference
 * passes every test and the starter does not ({@link #validationStatus} == VERIFIED for the current content).
 *
 * <p><b>Confidentiality:</b> {@link #hiddenTestFiles} and {@link #referenceFiles} must NEVER reach a
 * student-facing DTO or the AI hint assistant.
 */
@Entity
@Table(name = "coding_assessment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodingAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    /** One-line summary shown on catalogue cards (column kept as "description" for schema compatibility). */
    @Column(length = 4000)
    private String description;

    @Column(columnDefinition = "text")
    private String problemStatement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CodingType codingType;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CodingDifficulty difficulty = CodingDifficulty.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CodingAssessmentStatus status = CodingAssessmentStatus.DRAFT;

    /** Null on rows created before Coding Lab v2 - those are retired (archived) by migration V8. */
    @Enumerated(EnumType.STRING)
    private CodingRuntime runtime;

    private String technology;

    /** Derived from {@link #runtime}; kept because the column exists and is NOT NULL. */
    @Column(nullable = false)
    private String language;

    /** LEGACY - free-form shell commands are no longer executed. Column is nullable since V8. */
    private String runCommand;

    @Builder.Default
    private int timeLimitMinutes = 60;

    @Builder.Default
    private int memoryLimitMb = 512;

    /** Wall-clock budget for one sandbox test run. */
    @Builder.Default
    private int executionTimeoutSeconds = 60;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Map<String, Object>> requirements = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, String> starterFiles = new HashMap<>();

    /** Under tests/public/. Visible to candidates (read-only), run on every Run and on Submit. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> publicTestFiles = new HashMap<>();

    /** Under tests/hidden/. NEVER sent to the client. Run only on Submit, in a separate container. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> hiddenTestFiles = new HashMap<>();

    /** Overlaid on the starter files to prove the tests are passable. NEVER sent to the client. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> referenceFiles = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> allowedDependencies = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> tags = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> skills = List.of();

    private String targetJobRole;

    @Builder.Default
    private double maxScore = 100.0;

    // ------------------------------------------------------------------- provenance & verification

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AssessmentSource source = AssessmentSource.MANUAL;

    /** For AI_GENERATED: model, prompt parameters, repair rounds, timestamp. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> generationMeta = new HashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ValidationStatus validationStatus = ValidationStatus.UNVERIFIED;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> validationReport = new HashMap<>();

    /** {@link AssessmentBlueprint#contentHash()} at the moment of the last successful verification. */
    @Column(length = 64)
    private String validatedHash;

    private Instant validatedAt;

    // ------------------------------------------------------------------- AI hint policy

    @Builder.Default
    private boolean aiAssistantEnabled = true;

    @Builder.Default
    private int aiMaxHints = 5;

    @Builder.Default
    private int aiMaxRequests = 15;

    @Builder.Default
    private int aiCooldownSeconds = 20;

    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public List<RequirementSpec> requirementSpecs() { return RequirementSpec.fromMaps(requirements); }

    public boolean isLegacy() { return runtime == null; }

    public AssessmentBlueprint toBlueprint() {
        return new AssessmentBlueprint(title, codingType, difficulty, runtime, description, problemStatement,
                requirementSpecs(), starterFiles, publicTestFiles, hiddenTestFiles, referenceFiles,
                timeLimitMinutes, technology, targetJobRole, skills, tags);
    }

    /** True when the content that affects execution changed after the last successful verification. */
    public boolean verificationIsCurrent() {
        return validationStatus == ValidationStatus.VERIFIED && validatedHash != null
                && validatedHash.equals(toBlueprint().contentHash());
    }
}
