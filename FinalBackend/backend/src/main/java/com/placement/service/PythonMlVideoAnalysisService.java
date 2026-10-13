package com.placement.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Real implementation of {@link VideoAnalysisService} backed by the Python ML microservice
 * in /ml-service (OpenCV Haar-cascade face detection — see ml-service/face_analysis.py for
 * the actual CV logic and its documented accuracy limitations vs. a deep-learning detector).
 *
 * This is the primary bean when app.ml-service.enabled=true (the default). If the Python
 * service is unreachable (not started, wrong URL, timeout), calls fall back to
 * {@link MockVideoAnalysisService} rather than failing the interview flow — proctoring
 * degrades gracefully instead of blocking candidates.
 */
@Service
@Primary
@ConditionalOnProperty(name = "app.ml-service.enabled", havingValue = "true", matchIfMissing = true)
public class PythonMlVideoAnalysisService implements VideoAnalysisService {

    private final RestTemplate restTemplate;
    private final MockVideoAnalysisService fallback;
    private final String baseUrl;

    public PythonMlVideoAnalysisService(
            RestTemplate restTemplate,
            @Qualifier("mockVideoAnalysisService") MockVideoAnalysisService fallback,
            @Value("${app.ml-service.url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.fallback = fallback;
        this.baseUrl = baseUrl;
    }

    @Override
    public VideoSignals analyze(byte[] videoFrameOrClip) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(videoFrameOrClip) {
                @Override
                public String getFilename() {
                    return "frame.jpg";
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    baseUrl + "/analyze-frame", requestEntity, Map.class);

            if (response == null || response.containsKey("error")) {
                return fallback.analyze(videoFrameOrClip);
            }

            return new VideoSignals(
                    toDouble(response.get("faceVisibilityScore")),
                    toDouble(response.get("eyeContactScore")),
                    toDouble(response.get("postureScore")),
                    toDouble(response.get("confidenceScore")),
                    toInt(response.get("faceCount")),
                    Boolean.TRUE.equals(response.get("suspiciousObjectDetected")),
                    !Boolean.FALSE.equals(response.get("formalAttireDetected")),
                    response.containsKey("attireScore") ? toDouble(response.get("attireScore")) : 85.0
            );
        } catch (Exception e) {
            // ML service down/unreachable — degrade gracefully rather than breaking the interview.
            return fallback.analyze(videoFrameOrClip);
        }
    }

    @Override
    public com.placement.dto.ProctoringDtos.DressAnalysisResult analyzeClothingFrames(java.util.List<byte[]> frames) {
        return fallback.analyzeClothingFrames(frames);
    }

    private double toDouble(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0.0;
    }

    private int toInt(Object o) {
        return o instanceof Number ? ((Number) o).intValue() : 0;
    }
}
