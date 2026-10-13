package com.placement.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

/**
 * Client for the Python ML microservice's TF-IDF-based answer-similarity endpoint
 * (ml-service/text_analysis.py). Used by {@link AnswerEvaluationService} to enhance the
 * pure-Java keyword-overlap heuristic with a real (if classical) NLP similarity signal —
 * this gives partial credit for answers that paraphrase the right concepts instead of
 * only rewarding literal keyword matches.
 *
 * Returns Optional.empty() on any failure (service down, timeout, bad response) so the
 * caller can fall back to the local heuristic — the interview flow never breaks because
 * this optional enhancement is unavailable.
 */
@Service
@ConditionalOnProperty(name = "app.ml-service.enabled", havingValue = "true", matchIfMissing = true)
public class PythonNlpClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public PythonNlpClient(RestTemplate restTemplate, @Value("${app.ml-service.url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public Optional<Double> semanticSimilarity(String transcript, String expectedKeywords) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, String> payload = Map.of(
                    "transcript", transcript == null ? "" : transcript,
                    "expectedKeywords", expectedKeywords == null ? "" : expectedKeywords
            );
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(payload, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    baseUrl + "/evaluate-answer", entity, Map.class);

            if (response == null || response.containsKey("error") || !response.containsKey("correctness")) {
                return Optional.empty();
            }
            Object value = response.get("correctness");
            return value instanceof Number ? Optional.of(((Number) value).doubleValue()) : Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
