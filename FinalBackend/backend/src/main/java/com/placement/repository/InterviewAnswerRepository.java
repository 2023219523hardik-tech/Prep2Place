package com.placement.repository;

import com.placement.entity.InterviewAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InterviewAnswerRepository extends JpaRepository<InterviewAnswer, Long> {
    List<InterviewAnswer> findBySessionId(Long sessionId);
}
