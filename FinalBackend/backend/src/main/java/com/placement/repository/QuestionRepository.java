package com.placement.repository;

import com.placement.entity.Question;
import com.placement.entity.QuestionCategory;
import com.placement.entity.Difficulty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByCategory(QuestionCategory category);
    List<Question> findByDifficulty(Difficulty difficulty);
    List<Question> findByRoleId(Long roleId);
    List<Question> findByPublishedTrue();
    java.util.Optional<Question> findByCanonicalQuestionId(Long canonicalQuestionId);
}
