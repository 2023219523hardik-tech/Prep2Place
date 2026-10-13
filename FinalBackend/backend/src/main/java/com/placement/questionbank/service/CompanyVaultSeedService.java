package com.placement.questionbank.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.questionbank.config.CompanyVaultProperties;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.CompanySheetRow;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.ImportReport;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.IndexEntry;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.entity.CompanyQuestionRank;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.QuestionSourceMapping;
import com.placement.questionbank.repository.CompanyQuestionRankRepository;
import com.placement.questionbank.repository.CompanyRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * CompanyVault seed importer (requirements doc "CompanyVaultSeedService" / "CompanyVaultDataImporter").
 *
 * <p><b>What this does and does not own.</b> The general questionbank sync
 * ({@link QuestionSyncService}, via the LeetCode/GFG {@link com.placement.questionbank.adapter.QuestionSourceAdapter}s)
 * already owns creating/deduping {@link com.placement.questionbank.entity.CanonicalQuestion} rows
 * and their company TAGS ({@code CanonicalQuestion.companies}) - that pipeline runs first, at
 * startup, from {@code DataLoader} (see {@code com.placement.config.DataLoader}, order 10). This
 * service does not duplicate any of that: it never creates a CanonicalQuestion, and it never
 * touches {@code canonical_question_company}.
 *
 * <p>What it adds is the piece the source data has that the tag-based model can't represent: a
 * per-(company, question) {@code companyRank} and {@code frequencyScore} (see
 * {@link CompanyQuestionRank}), plus company-level stats from {@code _index.json} (see
 * {@link Company}). Those two fields exist in every {@code companyvault-seed/<slug>.json} row but
 * were previously discarded during the {@code scripts/merge_company_seed.py} merge step that
 * produced {@code questionbank-seed/leetcode.json} - this service reads the original per-company
 * files directly instead, so nothing from them is silently dropped anymore.
 *
 * <p><b>Ordering dependency.</b> Must run after canonical questions exist, i.e. after DataLoader's
 * {@code questionSyncService.syncAll()} call. See {@link CompanyVaultSeedLoader}, {@code @Order(16)}.
 *
 * <p><b>Idempotency.</b> Company rows are upserted by {@code slug} (unique constraint
 * {@code uk_company_slug}); rank rows are upserted by {@code (company_id, canonical_question_id)}
 * (unique constraint {@code uk_company_question}). Running this twice with the same input leaves
 * the database in the same state - see {@code CompanyVaultSeedServiceTest} for the exact assertion.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyVaultSeedService {

    /** _index.json entries whose "file" points at a full curriculum sheet, not a real company -
     *  see companyvault-seed/README.md. Never becomes a Company row. */
    private static final Set<String> NON_COMPANY_INDEX_FILES = Set.of(
            "_full-striver-a2z.json", "_full-striver-sde.json");

    private static final String INDEX_FILENAME = "_index.json";

    private final CompanyVaultProperties properties;
    private final CompanyRepository companyRepository;
    private final CompanyQuestionRankRepository rankRepository;
    private final QuestionSourceMappingRepository sourceMappingRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public ImportReport importAll() {
        ImportReport report = new ImportReport();
        if (!properties.isEnabled()) {
            log.info("CompanyVault seed import disabled (companyvault.enabled=false); skipping.");
            return report;
        }

        Resource[] resources;
        try {
            resources = new PathMatchingResourcePatternResolver().getResources(properties.getSeedClasspath());
        } catch (IOException e) {
            throw new IllegalStateException("Unable to resolve companyvault seed resources at '"
                    + properties.getSeedClasspath() + "'", e);
        }
        if (resources.length == 0) {
            log.warn("No CompanyVault seed files found at '{}'; nothing imported.", properties.getSeedClasspath());
            return report;
        }

        Resource indexResource = null;
        Map<String, Resource> companyFilesBySlug = new HashMap<>();
        for (Resource r : resources) {
            String filename = r.getFilename();
            if (filename == null) continue;
            if (filename.equals(INDEX_FILENAME)) {
                indexResource = r;
            } else if (!NON_COMPANY_INDEX_FILES.contains(filename)) {
                companyFilesBySlug.put(slugFromFilename(filename), r);
            }
        }

        Map<String, IndexEntry> indexBySlug = new HashMap<>();
        if (indexResource != null) {
            indexBySlug = loadIndex(indexResource, report);
        } else {
            log.warn("No {} found alongside CompanyVault seed files; companies will be created "
                    + "with name/slug only, no totalDistinctAvailable/includedInSheet/capped stats.",
                    INDEX_FILENAME);
        }

        // 1) Upsert every real company from the index first (covers companies whose sheet file
        //    might be missing, and gives every company its stats before rank rows reference it).
        for (IndexEntry entry : indexBySlug.values()) {
            upsertCompanyFromIndex(entry, report);
        }

        // 2) Walk every per-company sheet file, ensuring a Company row exists (for files like
        //    jtg-josh-technology-sheet.json -> "josh-technology" that have no _index.json entry),
        //    then import its rows.
        for (Map.Entry<String, Resource> e : companyFilesBySlug.entrySet()) {
            String slug = e.getKey();
            Company company = companyRepository.findBySlugIgnoreCase(slug).orElseGet(() -> {
                Company created = companyRepository.save(Company.builder()
                        .slug(slug)
                        .name(displayName(slug))
                        .build());
                report.setCompaniesUpserted(report.getCompaniesUpserted() + 1);
                return created;
            });
            importCompanyFile(company, e.getValue(), report);
        }

        log.info(report.toString());
        return report;
    }

    private Map<String, IndexEntry> loadIndex(Resource indexResource, ImportReport report) {
        Map<String, IndexEntry> bySlug = new HashMap<>();
        try (InputStream in = indexResource.getInputStream()) {
            List<IndexEntry> entries = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, IndexEntry.class));
            for (IndexEntry entry : entries) {
                if (entry.getFile() != null && NON_COMPANY_INDEX_FILES.contains(entry.getFile())) {
                    // e.g. "striver-a2z" / "striver-sde" - a curriculum sheet, not a company.
                    // Reported explicitly rather than silently dropped, per the "do not invent /
                    // do not silently discard" requirement.
                    report.getExcludedIndexEntries().add(entry.getCompany() + " (" + entry.getFile() + ")");
                    continue;
                }
                if (entry.getCompany() != null) {
                    String slug = resolvedIndexSlug(entry);
                    if (!slug.equals(entry.getCompany())) {
                        // Known source-data inconsistency: _index.json's "jtg" entry and
                        // jtg-josh-technology-sheet.json's own rows disagree on this company's slug
                        // ("jtg" vs "josh-technology"). Normalized to the file-derived slug (the
                        // same one scripts/merge_company_seed.py and the per-company-file import
                        // loop both use) so this becomes one Company row with real _index.json
                        // stats, not two - one merged, one bare - for the same company.
                        log.info("CompanyVault: normalized _index.json company slug '{}' -> '{}' "
                                + "(file '{}') to match the per-company-file slug convention.",
                                entry.getCompany(), slug, entry.getFile());
                    }
                    bySlug.put(slug, entry);
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("Unable to parse " + INDEX_FILENAME, e);
        }
        return bySlug;
    }

    /** _index.json normally uses the same slug as the per-company file (filename minus ".json"),
     *  but at least one entry doesn't (see loadIndex's log note) - fall back to deriving it from
     *  the referenced filename the same way slugFromFilename() does, so both paths agree. */
    private String resolvedIndexSlug(IndexEntry entry) {
        if (entry.getFile() != null && !entry.getFile().isBlank()) {
            return slugFromFilename(entry.getFile());
        }
        return entry.getCompany();
    }

    private void upsertCompanyFromIndex(IndexEntry entry, ImportReport report) {
        String slug = resolvedIndexSlug(entry);
        Company company = companyRepository.findBySlugIgnoreCase(slug).orElse(null);
        boolean isNew = company == null;
        if (isNew) {
            company = Company.builder().slug(slug).build();
        }
        company.setName(displayName(slug));
        company.setTotalDistinctAvailable(entry.getTotalDistinctAvailable());
        company.setIncludedInSheet(entry.getIncludedInSheet());
        company.setCapped(entry.getCapped());
        companyRepository.save(company);
        if (isNew) {
            report.setCompaniesUpserted(report.getCompaniesUpserted() + 1);
        }
    }

    private void importCompanyFile(Company company, Resource resource, ImportReport report) {
        List<CompanySheetRow> rows;
        try (InputStream in = resource.getInputStream()) {
            rows = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, CompanySheetRow.class));
        } catch (IOException e) {
            log.error("Failed to parse CompanyVault seed file '{}' for company '{}': {}",
                    resource.getFilename(), company.getSlug(), e.getMessage());
            report.setSkippedInvalidRow(report.getSkippedInvalidRow() + 1);
            return;
        }

        report.setCompanyFilesProcessed(report.getCompanyFilesProcessed() + 1);
        int skippedForThisCompany = 0;

        for (CompanySheetRow row : rows) {
            report.setRowsSeen(report.getRowsSeen() + 1);

            if (isBlank(row.getSourceQuestionId()) || isBlank(row.getTitle())) {
                report.setSkippedInvalidRow(report.getSkippedInvalidRow() + 1);
                skippedForThisCompany++;
                continue;
            }

            QuestionSource source = classifySource(row.getSourceUrl());
            if (source == null) {
                report.setSkippedUnresolvedSource(report.getSkippedUnresolvedSource() + 1);
                skippedForThisCompany++;
                continue;
            }

            Optional<QuestionSourceMapping> mapping =
                    sourceMappingRepository.findBySourceAndSourceQuestionId(source, row.getSourceQuestionId());
            if (mapping.isEmpty()) {
                // The general questionbank sync hasn't ingested this exact question (e.g. it was
                // one of the entries questionbank-seed/README.md documents as not ingested). We
                // do not create a CanonicalQuestion here - that stays QuestionSyncService's job -
                // so this row is reported as skipped rather than guessed at.
                report.setSkippedNoMatchingCanonicalQuestion(report.getSkippedNoMatchingCanonicalQuestion() + 1);
                skippedForThisCompany++;
                continue;
            }

            upsertRank(company, mapping.get().getCanonicalQuestion(), row, report);
        }

        if (skippedForThisCompany > 0) {
            report.getSkippedByCompany().put(company.getSlug(), skippedForThisCompany);
        }
    }

    private void upsertRank(Company company, com.placement.questionbank.entity.CanonicalQuestion canonicalQuestion,
                             CompanySheetRow row, ImportReport report) {
        var existing = rankRepository.findByCompanyIdAndCanonicalQuestionId(company.getId(), canonicalQuestion.getId());
        if (existing.isPresent()) {
            CompanyQuestionRank rank = existing.get();
            boolean changed = !java.util.Objects.equals(rank.getRank(), row.getCompanyRank())
                    || !java.util.Objects.equals(rank.getFrequencyScore(), row.getFrequencyScore());
            if (changed) {
                rank.setRank(row.getCompanyRank());
                rank.setFrequencyScore(row.getFrequencyScore());
                rankRepository.save(rank);
                report.setRanksUpdated(report.getRanksUpdated() + 1);
            }
        } else {
            // canonicalQuestion came straight out of a QuestionSourceMapping fetched in this same
            // transaction, so it's already a managed/persistent reference - safe to assign
            // directly as the association without re-fetching or risking a TransientObjectException.
            CompanyQuestionRank rank = CompanyQuestionRank.builder()
                    .company(company)
                    .canonicalQuestion(canonicalQuestion)
                    .rank(row.getCompanyRank())
                    .frequencyScore(row.getFrequencyScore())
                    .build();
            rankRepository.save(rank);
            report.setRanksCreated(report.getRanksCreated() + 1);
        }
    }

    private QuestionSource classifySource(String sourceUrl) {
        if (isBlank(sourceUrl)) return null;
        try {
            String host = URI.create(sourceUrl).getHost();
            if (host == null) return null;
            host = host.toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) host = host.substring(4);
            if (host.equals("leetcode.com")) return QuestionSource.LEETCODE;
            if (host.equals("geeksforgeeks.org") || host.equals("practice.geeksforgeeks.org")) return QuestionSource.GFG;
            return null; // interviewbit / codingninjas / spoj / bit.ly / anything else - no adapter maps these yet
        } catch (Exception e) {
            return null;
        }
    }

    /** jtg-josh-technology-sheet.json -> "josh-technology"; everything else -> filename minus
     *  ".json". Kept identical to scripts/merge_company_seed.py's slug_from_filename() so the two
     *  pipelines never disagree on what a given file's slug is. */
    private String slugFromFilename(String filename) {
        if (filename.equals("jtg-josh-technology-sheet.json")) {
            return "josh-technology";
        }
        return filename.endsWith(".json") ? filename.substring(0, filename.length() - 5) : filename;
    }

    private String displayName(String slug) {
        String[] parts = slug.split("-");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
