package com.placement.questionbank.controller;

import com.placement.entity.Difficulty;
import com.placement.questionbank.dto.QuestionBankDtos.*;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.DuplicateReviewRepository;
import com.placement.questionbank.repository.SyncRunRepository;
import com.placement.questionbank.service.DeduplicationService;
import com.placement.questionbank.service.QuestionBankQueryService;
import com.placement.questionbank.service.QuestionSyncService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Candidate-facing retrieval endpoints. Admin-only sync/dedup-review/stats endpoints live under
 * /api/admin/questionbank/** (see {@link QuestionBankAdminController}) so SecurityConfig's
 * existing "/api/admin/** requires ADMIN role" rule covers them automatically.
 *
 * Class-level @Transactional(readOnly = true): spring.jpa.open-in-view is false (see
 * application.yml), so without an explicit transaction here, CanonicalQuestionView.from() and
 * CompanyQuestionView both throw LazyInitializationException the moment they touch
 * CanonicalQuestion.sourceMappings (FetchType.LAZY) - that access happens in this controller,
 * after the repository call has already returned and its own transaction has closed. This was a
 * pre-existing gap on search()/getOne() too, just never triggered because no ingested question
 * previously had a populated sourceUrl to exercise the .from() mapping realistically.
 */
@RestController
@RequestMapping("/api/questionbank")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionBankController {

    private final QuestionBankQueryService queryService;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final CurrentUserService currentUserService;

    @GetMapping("/questions")
    public ResponseEntity<Page<CanonicalQuestionView>> search(
            @RequestParam(required = false) com.placement.questionbank.entity.QuestionDomain domain,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        Page<CanonicalQuestion> results = queryService.search(domain, difficulty, topic, company, language, q, pageable);
        java.util.List<CanonicalQuestionView> materialized = results.getContent().stream()
                .map(CanonicalQuestionView::from)
                .toList();
        return ResponseEntity.ok(new org.springframework.data.domain.PageImpl<>(
                materialized, pageable, results.getTotalElements()));
    }

    @GetMapping("/questions/{id}")
    public ResponseEntity<CanonicalQuestionView> getOne(@PathVariable Long id) {
        return canonicalQuestionRepository.findById(id)
                .map(CanonicalQuestionView::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Random selection honoring recent-attempt avoidance; used internally by mock-test generation
     *  too, but exposed here for ad-hoc "practice a random question" flows. */
    @GetMapping("/questions/random")
    public ResponseEntity<List<CanonicalQuestionView>> random(
            @RequestParam(required = false) com.placement.questionbank.entity.QuestionDomain domain,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(required = false) Set<Long> excludeIds) {
        List<CanonicalQuestion> selected = queryService.selectRandom(
                domain, difficulty, Math.min(count, 50), excludeIds == null ? Set.of() : excludeIds);
        return ResponseEntity.ok(selected.stream().map(CanonicalQuestionView::from).toList());
    }

    // --- Section 5: Company Vault ---

    /** Landing grid: every company with at least one available question, most questions first. */
    @GetMapping("/companies")
    public List<CompanySummary> listCompanies() {
        return queryService.listCompanies();
    }

    @GetMapping("/companies/{name}")
    public CompanyDetail companyDetail(@PathVariable String name) {
        return queryService.getCompanyDetail(name);
    }

    /** The actual gated list. Free/locked split (and what a locked entry omits) is entirely
     *  server-side - see QuestionBankQueryService.getCompanyQuestions. */
    @GetMapping("/companies/{name}/questions")
    public List<CompanyQuestionView> companyQuestions(@PathVariable String name) {
        boolean premium = currentUserService.getCurrentUser().isPremium();
        return queryService.getCompanyQuestions(name, premium);
    }
}
