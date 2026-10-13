package com.placement.service;

import com.placement.entity.Difficulty;
import com.placement.entity.Question;
import com.placement.entity.QuestionCategory;
import com.placement.exception.ApiException;
import com.placement.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class QuestionService {
    private final QuestionRepository questionRepository;
    private final Random random = new Random();

    public List<Question> list() { return questionRepository.findByPublishedTrue(); }

    public Question get(Long id) {
        return questionRepository.findById(id).orElseThrow(() -> ApiException.notFound("Question not found"));
    }

    public List<Question> byCategory(QuestionCategory category) { return questionRepository.findByCategory(category); }

    public List<Question> byDifficulty(Difficulty difficulty) { return questionRepository.findByDifficulty(difficulty); }

    public List<Question> byRole(Long roleId) { return questionRepository.findByRoleId(roleId); }

    public List<Question> random(int count, QuestionCategory category) {
        List<Question> pool = category != null ? byCategory(category) : list();
        Collections.shuffle(pool, random);
        return pool.stream().limit(Math.max(1, count)).toList();
    }
}
