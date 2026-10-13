package com.placement.questionbank.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Section 5 (Company Vault) follow-up: one row per (company, canonical question) pair, carrying
 * the company-specific {@code companyRank} and {@code frequencyScore} that the source per-company
 * sheets (companyvault-seed/*.json) provide but that the general LeetCode/GFG sync pipeline has no
 * way to store - {@link CanonicalQuestion#getCompanies()} is a flat list of company name strings
 * with no per-company ordering.
 *
 * A separate join entity (rather than columns on CanonicalQuestion) is required because the same
 * question can rank differently per company - e.g. "Two Sum" might be Google's #1 most-frequent
 * question and Airbnb's #40th.
 *
 * The unique constraint on (company_id, canonical_question_id) is the final idempotency guard for
 * {@link com.placement.questionbank.service.CompanyVaultSeedService}: re-running the importer
 * updates the existing row instead of creating a duplicate.
 */
@Entity
@Table(name = "company_question_rank", uniqueConstraints = {
        @UniqueConstraint(name = "uk_company_question", columnNames = {"company_id", "canonical_question_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyQuestionRank {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "canonical_question_id", nullable = false)
    private CanonicalQuestion canonicalQuestion;

    /** From the source sheet's "companyRank" (1 = most frequently asked at this company). Null
     *  when the source row didn't carry one (jtg-josh-technology-sheet.json rows do; some others
     *  may not). */
    @Column(name = "rank")
    private Integer rank;

    /** From the source sheet's "frequencyScore". Null when absent from the source row. */
    private Double frequencyScore;

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
