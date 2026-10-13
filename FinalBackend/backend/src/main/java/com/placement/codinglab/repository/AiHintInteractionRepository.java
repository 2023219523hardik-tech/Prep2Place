package com.placement.codinglab.repository;

import com.placement.codinglab.entity.AiHintInteraction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiHintInteractionRepository extends JpaRepository<AiHintInteraction, Long> {
    List<AiHintInteraction> findByAttemptIdOrderByRequestedAtAsc(Long attemptId);
    List<AiHintInteraction> findByAssessmentIdOrderByRequestedAtDesc(Long assessmentId);
}
