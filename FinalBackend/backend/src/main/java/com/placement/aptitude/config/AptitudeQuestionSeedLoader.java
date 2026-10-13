package com.placement.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.AptitudeQuestion;
import com.placement.entity.Difficulty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class AptitudeQuestionSeedLoader {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AptitudeQuestionSeed(
            String text, String topic, String difficulty,
            String optionA, String optionB, String optionC, String optionD,
            String correctOption, String explanation
    ) {}

    public List<AptitudeQuestionSeed> loadSeedQuestions() {
        try (InputStream is = new ClassPathResource("seed-data/aptitude-questions.json").getInputStream()) {
            return objectMapper.readValue(is, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, AptitudeQuestionSeed.class));
        } catch (IOException e) {
            log.warn("Failed to load aptitude-questions.json seed file: {}. Aptitude seeding skipped.", e.getMessage());
            return new ArrayList<>();
        }
    }

    public AptitudeQuestion toEntity(AptitudeQuestionSeed seed) {
        Difficulty difficulty = null;
        if (seed.difficulty() != null && !seed.difficulty().isBlank()) {
            try {
                difficulty = Difficulty.valueOf(seed.difficulty().trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                log.warn("Skipping aptitude seed row with invalid difficulty '{}': {}", seed.difficulty(), ex.getMessage());
                return null;
            }
        } else {
            log.warn("Skipping aptitude seed row with missing difficulty.");
            return null;
        }
        return AptitudeQuestion.builder()
                .text(seed.text())
                .topic(seed.topic())
                .difficulty(difficulty)
                .optionA(seed.optionA()).optionB(seed.optionB()).optionC(seed.optionC()).optionD(seed.optionD())
                .correctOption(seed.correctOption())
                .explanation(seed.explanation())
                .build();
    }
}
