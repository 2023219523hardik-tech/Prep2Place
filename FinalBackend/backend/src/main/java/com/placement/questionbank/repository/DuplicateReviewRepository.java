package com.placement.questionbank.repository;

import com.placement.questionbank.entity.DuplicateReview;
import com.placement.questionbank.entity.DuplicateReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DuplicateReviewRepository extends JpaRepository<DuplicateReview, Long> {
    List<DuplicateReview> findByStatus(DuplicateReviewStatus status);

    Optional<DuplicateReview> findByQuestionAIdAndQuestionBId(Long a, Long b);
}
