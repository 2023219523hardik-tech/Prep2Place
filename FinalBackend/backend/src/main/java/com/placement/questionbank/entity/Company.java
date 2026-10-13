package com.placement.questionbank.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Section 5 (Company Vault) follow-up: a first-class row per company, sourced from
 * {@code companyvault-seed/_index.json}. Before this entity existed, "a company" was only ever a
 * free-text string tag on {@link CanonicalQuestion#getCompanies()} - that still works and is left
 * untouched (see {@code canonical_question_company}), but it can't carry company-level stats like
 * how many questions the source pool has for that company vs. how many were actually curated into
 * the sheet. This entity exists so that can be reported without touching the tag-based path.
 *
 * Not every company tag in {@code canonical_question_company} has a corresponding row here - only
 * companies present in {@code _index.json} do. {@link com.placement.questionbank.service.CompanyVaultSeedService}
 * is the only writer of this table.
 */
@Entity
@Table(name = "company", uniqueConstraints = {
        @UniqueConstraint(name = "uk_company_slug", columnNames = "slug")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable natural key - matches the string used in {@code CanonicalQuestion.companies} and in
     *  the {@code /api/questionbank/companies/{name}} path variable (e.g. "goldman-sachs"). */
    @Column(nullable = false, length = 150)
    private String slug;

    @Column(nullable = false, length = 200)
    private String name;

    /** From _index.json "totalDistinctAvailable" - how many distinct questions the source pool
     *  had tagged for this company, before capping. Null if this company has no _index.json entry. */
    private Integer totalDistinctAvailable;

    /** From _index.json "includedInSheet" - how many of those were actually included in the
     *  per-company sheet file that gets imported. */
    private Integer includedInSheet;

    /** From _index.json "capped" - true when includedInSheet < totalDistinctAvailable, i.e. the
     *  sheet was deliberately truncated rather than exhaustive. */
    private Boolean capped;

    @Column(length = 500)
    private String logoUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String website;

    @Builder.Default
    @Column(length = 50)
    private String status = "ACTIVE";

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
