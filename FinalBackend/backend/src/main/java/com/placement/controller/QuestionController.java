package com.placement.controller;

import com.placement.entity.Difficulty;
import com.placement.entity.Question;
import com.placement.entity.QuestionCategory;
import com.placement.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {
    private final QuestionService questionService;

    @GetMapping
    public List<Question> list() { return questionService.list(); }

    @GetMapping("/{questionId}")
    public Question get(@PathVariable Long questionId) { return questionService.get(questionId); }

    @GetMapping("/category/{category}")
    public List<Question> byCategory(@PathVariable String category) {
        return questionService.byCategory(QuestionCategory.valueOf(category.toUpperCase()));
    }

    @GetMapping("/difficulty/{difficulty}")
    public List<Question> byDifficulty(@PathVariable String difficulty) {
        return questionService.byDifficulty(Difficulty.valueOf(difficulty.toUpperCase()));
    }

    @GetMapping("/role/{roleId}")
    public List<Question> byRole(@PathVariable Long roleId) { return questionService.byRole(roleId); }

    @GetMapping("/random")
    public List<Question> random(@RequestParam(defaultValue = "5") int count, @RequestParam(required = false) String category) {
        QuestionCategory cat = category == null ? null : QuestionCategory.valueOf(category.toUpperCase());
        return questionService.random(count, cat);
    }
}
