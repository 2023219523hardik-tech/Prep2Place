package com.placement.questionbank.repository;

import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.QuestionSourceMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionSourceMappingRepository extends JpaRepository<QuestionSourceMapping, Long> {

    Optional<QuestionSourceMapping> findBySourceAndSourceQuestionId(QuestionSource source, String sourceQuestionId);

    List<QuestionSourceMapping> findByCanonicalQuestionId(Long canonicalQuestionId);

    long countBySource(QuestionSource source);
}
