package com.placement.questionbank.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.questionbank.config.CompanyVaultProperties;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.CompanySheetRow;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.IndexEntry;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.QuestionSourceMapping;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanySheetLoader {

    private static final Set<String> NON_COMPANY_INDEX_FILES = Set.of(
            "_full-striver-a2z.json", "_full-striver-sde.json");
    private static final String INDEX_FILENAME = "_index.json";

    private final CompanyVaultProperties properties;
    private final QuestionSourceMappingRepository sourceMappingRepository;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final ResourceLoader resourceLoader;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ConcurrentMap<String, List<AuthorizedSheetEntry>> authorizedByCompany = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, IndexEntry> indexBySlug = new ConcurrentHashMap<>();

    @Getter
    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        try {
            loadIndex();
            initialized = true;
        } catch (Exception e) {
            log.warn("CompanySheetLoader: index pre-load failed (continuing without sheets, fallback to tag-based): {}",
                    e.getMessage());
            initialized = false;
        }
    }

    private void loadIndex() {
        Resource indexResource = resolve(properties.getSheetsPath() + INDEX_FILENAME);
        if (indexResource == null || !indexResource.exists()) {
            log.warn("CompanySheetLoader: no _index.json at '{}' - sheet path will be empty.", properties.getSheetsPath());
            return;
        }
        try (InputStream in = indexResource.getInputStream()) {
            List<IndexEntry> entries = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, IndexEntry.class));
            for (IndexEntry entry : entries) {
                if (entry.getFile() != null && NON_COMPANY_INDEX_FILES.contains(entry.getFile())) {
                    continue;
                }
                if (entry.getCompany() == null) continue;
                String slug = resolveIndexSlug(entry);
                indexBySlug.put(slug.toLowerCase(Locale.ROOT), entry);
            }
            log.info("CompanySheetLoader: loaded _index.json with {} company entries.", indexBySlug.size());
        } catch (IOException e) {
            log.warn("CompanySheetLoader: failed to parse _index.json: {}", e.getMessage());
        }
    }

    public Map<String, IndexEntry> getSheetIndex() {
        return Collections.unmodifiableMap(indexBySlug);
    }

    public Optional<IndexEntry> findIndexEntry(String companySlug) {
        if (companySlug == null) return Optional.empty();
        return Optional.ofNullable(indexBySlug.get(companySlug.toLowerCase(Locale.ROOT)));
    }

    public List<AuthorizedSheetEntry> getAuthorizedRankedList(String companySlug) {
        if (companySlug == null) return Collections.emptyList();
        String key = companySlug.toLowerCase(Locale.ROOT);
        return authorizedByCompany.computeIfAbsent(key, this::loadCompanySheet);
    }

    private List<AuthorizedSheetEntry> loadCompanySheet(String slug) {
        IndexEntry entry = indexBySlug.get(slug);
        if (entry == null) {
            log.warn("CompanySheetLoader: no _index entry for slug '{}' - returning empty authorized list.", slug);
            return Collections.emptyList();
        }
        String file = entry.getFile();
        if (file == null || file.isBlank()) {
            file = slug + ".json";
        }
        Resource resource = resolve(properties.getSheetsPath() + file);
        if (resource == null || !resource.exists()) {
            log.warn("CompanySheetLoader: sheet file '{}' not found for slug '{}' - returning empty.", file, slug);
            return Collections.emptyList();
        }
        List<CompanySheetRow> rows;
        try (InputStream in = resource.getInputStream()) {
            rows = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, CompanySheetRow.class));
        } catch (IOException e) {
            log.warn("CompanySheetLoader: failed to parse '{}': {} - returning empty.", file, e.getMessage());
            return Collections.emptyList();
        }

        List<AuthorizedSheetEntry> out = new ArrayList<>(rows.size());
        for (CompanySheetRow row : rows) {
            if (row.getSourceQuestionId() == null || row.getSourceQuestionId().isBlank()) continue;
            Long canonicalId = resolveCanonicalQuestionId(row);
            AuthorizedSheetEntry ase = new AuthorizedSheetEntry(
                    row.getSourceQuestionId(),
                    row.getTitle(),
                    row.getSourceUrl(),
                    parseDifficulty(row.getDifficulty()),
                    canonicalId,
                    row.getCompanyRank(),
                    row.getFrequencyScore()
            );
            out.add(ase);
        }
        out.sort(Comparator.comparing(
                (AuthorizedSheetEntry e) -> e.rank() == null ? Integer.MAX_VALUE : e.rank(),
                Comparator.nullsLast(Integer::compareTo)
        ).thenComparing(e -> e.title() == null ? "" : e.title().toLowerCase(Locale.ROOT)));
        log.info("CompanySheetLoader: loaded {} authorized entries for '{}' ({} resolved to canonical IDs).",
                out.size(), slug, out.stream().filter(e -> e.canonicalQuestionId() != null).count());
        return Collections.unmodifiableList(out);
    }

    @Transactional(readOnly = true)
    public Long resolveCanonicalQuestionId(CompanySheetRow row) {
        QuestionSource source = classifySource(row.getSourceUrl());
        if (source != null) {
            Optional<QuestionSourceMapping> mapping =
                    sourceMappingRepository.findBySourceAndSourceQuestionId(source, row.getSourceQuestionId());
            if (mapping.isPresent()) {
                return mapping.get().getCanonicalQuestion().getId();
            }
        }
        String normalizedTitle = normalizeTitle(row.getTitle());
        if (normalizedTitle != null) {
            Optional<CanonicalQuestion> byTitle =
                    canonicalQuestionRepository.findByNormalizedTitleKeyAndActiveTrue(normalizedTitle);
            if (byTitle.isPresent()) return byTitle.get().getId();
        }
        return null;
    }

    private QuestionSource classifySource(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) return QuestionSource.LEETCODE;
        try {
            String host = URI.create(sourceUrl).getHost();
            if (host == null) return QuestionSource.LEETCODE;
            host = host.toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) host = host.substring(4);
            if (host.equals("leetcode.com")) return QuestionSource.LEETCODE;
            if (host.equals("geeksforgeeks.org") || host.equals("practice.geeksforgeeks.org")) return QuestionSource.GFG;
            return QuestionSource.LEETCODE;
        } catch (Exception e) {
            return QuestionSource.LEETCODE;
        }
    }

    private String normalizeTitle(String title) {
        if (title == null) return null;
        String s = title.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return s.isEmpty() ? null : s;
    }

    private com.placement.entity.Difficulty parseDifficulty(String d) {
        if (d == null) return null;
        try { return com.placement.entity.Difficulty.valueOf(d.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    private String resolveIndexSlug(IndexEntry entry) {
        if (entry.getFile() != null && !entry.getFile().isBlank()) {
            return slugFromFilename(entry.getFile());
        }
        return entry.getCompany();
    }

    private String slugFromFilename(String filename) {
        if (filename.equals("jtg-josh-technology-sheet.json")) {
            return "josh-technology";
        }
        return filename.endsWith(".json") ? filename.substring(0, filename.length() - 5) : filename;
    }

    private Resource resolve(String path) {
        if (path == null) return null;
        try {
            Resource r = resourceLoader.getResource(path);
            if (r.exists()) return r;
        } catch (Exception ignored) {}
        if (!path.startsWith("file:")) {
            try {
                Resource r = resourceLoader.getResource("file:./" + path);
                if (r.exists()) return r;
            } catch (Exception ignored) {}
        }
        return null;
    }

    public record AuthorizedSheetEntry(
            String sourceQuestionId,
            String title,
            String sourceUrl,
            com.placement.entity.Difficulty difficulty,
            Long canonicalQuestionId,
            Integer rank,
            Double frequencyScore
    ) {}
}
