package com.placement.questionbank.adapter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.Difficulty;
import com.placement.questionbank.adapter.dto.RawSourceQuestion;
import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.SourceIntegrationMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shared implementation for the four launch adapters (TUF/LeetCode/HackerRank/GFG). Each currently
 * runs in METADATA_REFERENCE_ONLY mode by default, reading admin-curated metadata from a classpath
 * JSON file rather than calling a live API - see {@link SourceIntegrationMode} and
 * questionbank-seed/README.md for exactly why and how to change that once a source's terms and a
 * real API/dataset are confirmed.
 *
 * A subclass only needs to supply its {@link QuestionSource} and the classpath of its seed file;
 * if `apiBaseUrl`/`apiKey` are ever configured AND integrationMode is switched to OFFICIAL_API,
 * a subclass can override {@link #fetchAll()} to call the real endpoint instead.
 */
@Slf4j
public abstract class MetadataSeedAdapter implements QuestionSourceAdapter {

    private final ObjectMapper objectMapper = new ObjectMapper();
    protected final QuestionSourceProperties.SourceConfig config;

    protected MetadataSeedAdapter(QuestionSourceProperties.SourceConfig config) {
        this.config = config;
    }

    protected abstract String defaultSeedClasspath();

    @Override
    public boolean isEnabled() {
        return config.isEnabled();
    }

    @Override
    public SourceIntegrationMode getIntegrationMode() {
        try {
            return SourceIntegrationMode.valueOf(config.getIntegrationMode());
        } catch (Exception e) {
            return SourceIntegrationMode.METADATA_REFERENCE_ONLY;
        }
    }

    @Override
    public List<RawSourceQuestion> fetchAll() {
        if (getIntegrationMode() == SourceIntegrationMode.OFFICIAL_API && config.getApiBaseUrl() != null) {
            // A real, confirmed API has been configured for this source - but no such integration
            // has been implemented/verified in this codebase yet. Fail loudly rather than silently
            // falling back, so a misconfiguration is never mistaken for a working live sync.
            throw new UnsupportedOperationException(
                    "OFFICIAL_API mode is configured for " + getSource() +
                    " but no verified API client has been implemented for it yet. " +
                    "Implement and test the real HTTP integration in this adapter before enabling this mode.");
        }
        return loadSeed();
    }

    @SuppressWarnings("unchecked")
    private List<RawSourceQuestion> loadSeed() {
        String path = config.getCuratedSeedClasspath() != null ? config.getCuratedSeedClasspath() : defaultSeedClasspath();
        List<RawSourceQuestion> results = new ArrayList<>();
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            List<Map<String, Object>> raw = objectMapper.readValue(in, List.class);
            for (Map<String, Object> item : raw) {
                results.add(RawSourceQuestion.builder()
                        .source(getSource())
                        .sourceQuestionId(String.valueOf(item.get("sourceQuestionId")))
                        .title(String.valueOf(item.get("title")))
                        .sourceUrl(String.valueOf(item.get("sourceUrl")))
                        .integrationMode(SourceIntegrationMode.METADATA_REFERENCE_ONLY)
                        .difficulty(parseDifficulty(item.get("difficulty")))
                        .topics((List<String>) item.getOrDefault("topics", List.of()))
                        .subtopics((List<String>) item.getOrDefault("subtopics", List.of()))
                        .companies((List<String>) item.getOrDefault("companies", List.of()))
                        .tags((List<String>) item.getOrDefault("tags", List.of()))
                        .supportedLanguages((List<String>) item.getOrDefault("supportedLanguages", List.of()))
                        .attribution("Metadata reference only - full problem statement available at source URL (" + getSource() + ").")
                        .build());
            }
        } catch (Exception e) {
            log.error("Failed to load curated seed for source {} at classpath '{}': {}", getSource(), path, e.getMessage());
            throw new RuntimeException("Unable to load seed metadata for " + getSource(), e);
        }
        return results;
    }

    private Difficulty parseDifficulty(Object value) {
        if (value == null) return Difficulty.MEDIUM;
        try {
            return Difficulty.valueOf(String.valueOf(value).toUpperCase());
        } catch (Exception e) {
            return Difficulty.MEDIUM;
        }
    }
}
