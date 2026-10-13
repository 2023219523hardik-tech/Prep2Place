package com.placement.controller;

import com.placement.entity.Difficulty;
import com.placement.exception.ApiException;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/technical")
@RequiredArgsConstructor
public class TechMcqController {

    private final TechnicalMcqQuestionRepository repository;

    public record PublicQ(Long id, String questionText, List<String> options, String topic, String difficulty) {}
    public record PublicPage(List<PublicQ> content, long total, int page, int size) {}
    public record SubmitReq(Long questionId, Integer selectedIndex) {}
    public record SubmitResp(boolean correct, Integer correctIndex, String explanation) {}

    @GetMapping("/questions")
    public PublicPage getQuestions(
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String subtopic,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String difficulty,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {

        TechnicalCategory cat = parseCategory(category);
        Difficulty diff = parseDifficulty(difficulty);

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 500));
        Page<TechnicalMcqQuestion> result = repository.search(cat, diff, topic, subtopic, search, pageable);

        List<PublicQ> content = result.getContent().stream()
                .map(this::toPublicQ)
                .collect(Collectors.toList());

        return new PublicPage(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    @PostMapping("/questions/submit")
    public SubmitResp submitAnswer(@RequestBody SubmitReq req) {
        if (req.selectedIndex() == null || req.selectedIndex() < 0 || req.selectedIndex() > 3) {
            throw ApiException.badRequest("selectedIndex must be between 0 and 3");
        }

        TechnicalMcqQuestion q = repository.findById(req.questionId())
                .orElseThrow(() -> ApiException.notFound("Question not found with id: " + req.questionId()));

        List<String> optionKeys = q.getOptions().stream()
                .map(m -> m.get("key"))
                .collect(Collectors.toList());

        Integer correctIndex = null;
        if (!q.getCorrectOptions().isEmpty() && !optionKeys.isEmpty()) {
            String correctKey = q.getCorrectOptions().get(0);
            correctIndex = optionKeys.indexOf(correctKey);
            if (correctIndex < 0) correctIndex = 0;
        } else {
            correctIndex = 0;
        }

        boolean correct = correctIndex.equals(req.selectedIndex());

        return new SubmitResp(correct, correctIndex, q.getExplanation());
    }

    private TechnicalCategory parseCategory(String category) {
        if (category == null || category.isBlank()) return null;
        try {
            return TechnicalCategory.valueOf(category.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Difficulty parseDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return null;
        try {
            return Difficulty.valueOf(difficulty.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private PublicQ toPublicQ(TechnicalMcqQuestion q) {
        List<String> optionTexts = q.getOptions().stream()
                .map(m -> {
                    String text = m.get("text");
                    return text != null ? text : "";
                })
                .collect(Collectors.toList());

        String diffStr = q.getDifficulty() != null ? q.getDifficulty().name() : Difficulty.MEDIUM.name();

        return new PublicQ(q.getId(), q.getQuestionText(), optionTexts, q.getTopic(), diffStr);
    }
}
