package com.placement.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A reusable, admin-configurable assessment definition. One profile can back a specific mock test
 * (e.g. "Mock Test 17"), a generic aptitude test, an AI interview scope, or a named company
 * profile (e.g. "Amazon SDE-1 style") - the same shape covers all of them so no code changes are
 * needed to add a new profile, only new rows.
 */
@Entity
@Table(name = "assessment_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name; // e.g. "Coding Mock Test 17", "TCS NQT Style Aptitude", "Amazon SDE-1 Interview"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssessmentType assessmentType;

    /** Null/blank for generic (non-company-specific) profiles. Never presented as an official
     *  reproduction of a real company's actual hiring process unless that has been explicitly confirmed. */
    private String companyName;

    @Builder.Default
    private boolean active = true;

    // ---- structure ----
    @Builder.Default
    private int durationMinutes = 60;
    @Builder.Default
    private int questionCount = 10;

    /** e.g. {"EASY": 4, "MEDIUM": 4, "HARD": 2} - counts, not percentages, so questionCount is authoritative. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Integer> difficultyDistribution = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> topicFocus = new java.util.ArrayList<>(); // DSA topics or aptitude categories, weighting is soft (best-effort)

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> companyRelevance = new java.util.ArrayList<>(); // company tags to prefer when selecting questions

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> allowedLanguages = new java.util.ArrayList<>(); // for coding profiles

    // ---- scoring ----
    @Builder.Default
    private double pointsPerCorrect = 1.0;
    @Builder.Default
    private boolean negativeMarkingEnabled = false;
    @Builder.Default
    private double negativeMarkingPenalty = 0.25;

    // ---- environment / proctoring requirements ----
    @Builder.Default private boolean cameraRequired = false;
    @Builder.Default private boolean microphoneRequired = false;
    @Builder.Default private boolean screenShareRequired = false;
    @Builder.Default private boolean fullscreenRequired = false;
    // Universal anti-cheat defaults (Section 6): copy/paste and the context menu are disabled and
    // any tab-switch/window-blur/fullscreen-exit terminates the attempt immediately, unless a
    // profile explicitly opts into something more lenient (e.g. an untimed practice mode).
    @Builder.Default private boolean allowCopy = false;
    @Builder.Default private boolean allowPaste = false;
    @Builder.Default private boolean allowContextMenu = false;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TabSwitchPolicy tabSwitchPolicy = TabSwitchPolicy.TERMINATE;

    /** Seconds of continuous focus loss before it counts as a violation event (vs. a harmless blip).
     *  Zero by default per the universal "instant termination" policy - set above zero only for a
     *  profile that has deliberately opted for a grace period. */
    @Builder.Default
    private int focusLossThresholdSeconds = 0;

    /** Number of recorded violations before automatic termination. 0 = never auto-terminate on count alone. */
    @Builder.Default
    private int violationCountThreshold = 5;

    @Builder.Default
    private boolean terminateOnFirstFullscreenExit = true;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ResumePolicy resumePolicy = ResumePolicy.ALLOWED_SAME_SESSION;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ReportVisibility reportVisibility = ReportVisibility.CANDIDATE_AND_RECRUITER;

    public enum TabSwitchPolicy { IGNORE, WARN, TERMINATE }
    public enum ResumePolicy { ALLOWED_SAME_SESSION, NOT_ALLOWED }
    public enum ReportVisibility { CANDIDATE_ONLY, CANDIDATE_AND_RECRUITER }
}
