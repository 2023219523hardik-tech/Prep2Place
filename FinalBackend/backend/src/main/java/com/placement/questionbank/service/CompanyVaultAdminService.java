package com.placement.questionbank.service;

import com.placement.entity.Difficulty;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.CompanySheetRow;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.IndexEntry;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.CompanyQuestionRankRepository;
import com.placement.questionbank.repository.CompanyRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import com.placement.repository.CodingProblemRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyVaultAdminService {

    private final CompanyRepository companyRepository;
    private final CompanyQuestionRankRepository rankRepository;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final QuestionSourceMappingRepository sourceMappingRepository;
    private final CodingProblemRepository codingProblemRepository;
    private final CompanyVaultSeedService companyVaultSeedService;

    @Data
    @Builder
    public static class CompanyAdminView {
        private Long id;
        private String name;
        private String slug;
        private Integer totalDistinctAvailable;
        private Integer includedInSheet;
        private Boolean capped;
        private long questionCount;
    }

    @Data
    @Builder
    public static class SeedResult {
        private String companyName;
        private String companySlug;
        private int inserted;
        private int updated;
        private int totalProcessed;
        private String message;
    }

    public List<CompanyAdminView> listCompanies() {
        List<Company> companies = companyRepository.findAll();
        List<CompanyAdminView> views = new ArrayList<>();
        for (Company c : companies) {
            long qCount = rankRepository.countByCompanyId(c.getId());
            views.add(CompanyAdminView.builder()
                    .id(c.getId())
                    .name(c.getName() != null ? c.getName() : c.getSlug())
                    .slug(c.getSlug())
                    .totalDistinctAvailable(c.getTotalDistinctAvailable())
                    .includedInSheet(c.getIncludedInSheet())
                    .capped(c.getCapped())
                    .questionCount(qCount)
                    .build());
        }
        views.sort((a, b) -> Long.compare(b.getQuestionCount(), a.getQuestionCount()));
        return views;
    }

    @Transactional
    public Company createCompany(String name, String slug) {
        String cleanSlug = slug != null && !slug.isBlank()
                ? slug.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-")
                : name.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
        String cleanName = name != null && !name.isBlank() ? name.trim() : cleanSlug;

        Optional<Company> existing = companyRepository.findBySlugIgnoreCase(cleanSlug);
        if (existing.isPresent()) {
            Company c = existing.get();
            c.setName(cleanName);
            return companyRepository.save(c);
        }

        Company company = Company.builder()
                .name(cleanName)
                .slug(cleanSlug)
                .includedInSheet(0)
                .totalDistinctAvailable(0)
                .capped(false)
                .build();
        return companyRepository.save(company);
    }

    @Transactional
    public SeedResult seedCompany(String companySlug, String companyName, List<CompanySheetRow> questions) {
        if (companySlug == null || companySlug.isBlank()) {
            throw new IllegalArgumentException("Company slug is required for seeding.");
        }
        String cleanSlug = companySlug.trim().toLowerCase();
        Company company = companyRepository.findBySlugIgnoreCase(cleanSlug).orElseGet(() -> {
            String displayName = companyName != null && !companyName.isBlank()
                    ? companyName.trim()
                    : cleanSlug.substring(0, 1).toUpperCase() + cleanSlug.substring(1);
            return createCompany(displayName, cleanSlug);
        });

        int inserted = 0;
        int updated = 0;

        for (CompanySheetRow row : questions) {
            if (row.getTitle() == null || row.getTitle().isBlank()) {
                continue;
            }

            CanonicalQuestion canonical = resolveOrCreateCanonical(row, cleanSlug);
            var rankOpt = rankRepository.findByCompanyIdAndCanonicalQuestionId(company.getId(), canonical.getId());

            Integer rankVal = row.getCompanyRank();
            Double freqVal = row.getFrequencyScore();

            if (rankOpt.isPresent()) {
                CompanyQuestionRank r = rankOpt.get();
                boolean changed = false;
                if (!Objects.equals(r.getRank(), rankVal)) {
                    r.setRank(rankVal);
                    changed = true;
                }
                if (!Objects.equals(r.getFrequencyScore(), freqVal)) {
                    r.setFrequencyScore(freqVal);
                    changed = true;
                }
                if (changed) {
                    rankRepository.save(r);
                    updated++;
                }
            } else {
                CompanyQuestionRank newRank = CompanyQuestionRank.builder()
                        .company(company)
                        .canonicalQuestion(canonical)
                        .rank(rankVal)
                        .frequencyScore(freqVal)
                        .build();
                rankRepository.save(newRank);
                inserted++;
            }

            ensureCodingProblem(canonical, row, cleanSlug);
        }

        long totalRanked = rankRepository.countByCompanyId(company.getId());
        company.setIncludedInSheet((int) totalRanked);
        if (company.getTotalDistinctAvailable() == null || company.getTotalDistinctAvailable() < totalRanked) {
            company.setTotalDistinctAvailable((int) totalRanked);
        }
        companyRepository.save(company);

        return SeedResult.builder()
                .companyName(company.getName())
                .companySlug(company.getSlug())
                .inserted(inserted)
                .updated(updated)
                .totalProcessed(questions.size())
                .message("Successfully seeded " + inserted + " new and updated " + updated + " questions for " + company.getName())
                .build();
    }

    @Transactional
    public SeedResult seedIndex(List<IndexEntry> entries) {
        int count = 0;
        for (IndexEntry entry : entries) {
            if (entry.getCompany() == null || entry.getCompany().isBlank()) continue;
            String slug = entry.getCompany().trim().toLowerCase();
            Company company = companyRepository.findBySlugIgnoreCase(slug).orElseGet(() ->
                    Company.builder().slug(slug).name(slug.substring(0, 1).toUpperCase() + slug.substring(1)).build()
            );
            if (entry.getTotalDistinctAvailable() != null) company.setTotalDistinctAvailable(entry.getTotalDistinctAvailable());
            if (entry.getIncludedInSheet() != null) company.setIncludedInSheet(entry.getIncludedInSheet());
            if (entry.getCapped() != null) company.setCapped(entry.getCapped());
            companyRepository.save(company);
            count++;
        }
        return SeedResult.builder()
                .companyName("Index Entries")
                .companySlug("_index")
                .inserted(count)
                .updated(0)
                .totalProcessed(entries.size())
                .message("Imported/updated " + count + " companies from index.")
                .build();
    }

    private CanonicalQuestion resolveOrCreateCanonical(CompanySheetRow row, String companySlug) {
        String title = row.getTitle().trim();
        String normalizedKey = normalize(title);

        Optional<CanonicalQuestion> byKey = canonicalQuestionRepository.findByNormalizedTitleKeyAndActiveTrue(normalizedKey);
        if (byKey.isPresent()) {
            CanonicalQuestion q = byKey.get();
            addCompanyTagIfMissing(q, companySlug);
            return q;
        }

        Difficulty diff = parseDifficulty(row.getDifficulty());
        CanonicalQuestion newQ = CanonicalQuestion.builder()
                .canonicalTitle(title)
                .normalizedTitleKey(normalizedKey)
                .description(title)
                .domain(QuestionDomain.CODING)
                .difficulty(diff)
                .availabilityState(QuestionAvailabilityState.AVAILABLE)
                .active(true)
                .topics(row.getTopics() != null ? new ArrayList<>(row.getTopics()) : new ArrayList<>())
                .companies(new ArrayList<>(List.of(companySlug)))
                .build();
        newQ = canonicalQuestionRepository.save(newQ);

        String srcId = row.getSourceQuestionId() != null && !row.getSourceQuestionId().isBlank()
                ? row.getSourceQuestionId() : normalizedKey;
        String srcUrl = row.getSourceUrl() != null && !row.getSourceUrl().isBlank()
                ? row.getSourceUrl() : "https://leetcode.com/problemset/all/";

        QuestionSourceMapping mapping = QuestionSourceMapping.builder()
                .canonicalQuestion(newQ)
                .source(QuestionSource.LEETCODE)
                .sourceQuestionId(srcId)
                .sourceTitle(title)
                .sourceUrl(srcUrl)
                .build();
        sourceMappingRepository.save(mapping);

        return newQ;
    }

    private void addCompanyTagIfMissing(CanonicalQuestion q, String companySlug) {
        if (q.getCompanies() == null) {
            q.setCompanies(new ArrayList<>());
        }
        boolean exists = q.getCompanies().stream().anyMatch(c -> c.equalsIgnoreCase(companySlug));
        if (!exists) {
            q.getCompanies().add(companySlug);
            canonicalQuestionRepository.save(q);
        }
    }

    private void ensureCodingProblem(CanonicalQuestion q, CompanySheetRow row, String companySlug) {
        var existing = codingProblemRepository.findAll().stream()
                .filter(p -> p.getTitle() != null && p.getTitle().trim().equalsIgnoreCase(q.getCanonicalTitle().trim()))
                .findFirst();

        if (existing.isPresent()) {
            var p = existing.get();
            if (p.getCompanyTags() == null || !p.getCompanyTags().toLowerCase().contains(companySlug.toLowerCase())) {
                String updatedTags = p.getCompanyTags() == null || p.getCompanyTags().isBlank()
                        ? companySlug
                        : p.getCompanyTags() + ", " + companySlug;
                p.setCompanyTags(updatedTags);
                codingProblemRepository.save(p);
            }
        } else {
            var prob = com.placement.entity.CodingProblem.builder()
                    .title(q.getCanonicalTitle())
                    .statement(q.getDescription() != null ? q.getDescription() : q.getCanonicalTitle())
                    .difficulty(q.getDifficulty())
                    .category("CODING")
                    .active(true)
                    .companyTags(companySlug)
                    .sourceUrl(row.getSourceUrl())
                    .canonicalQuestionId(q.getId())
                    .build();
            codingProblemRepository.save(prob);
        }
    }

    private Difficulty parseDifficulty(String diffStr) {
        if (diffStr == null || diffStr.isBlank()) return Difficulty.MEDIUM;
        try {
            return Difficulty.valueOf(diffStr.trim().toUpperCase());
        } catch (Exception e) {
            return Difficulty.MEDIUM;
        }
    }

    private String normalize(String s) {
        return s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
