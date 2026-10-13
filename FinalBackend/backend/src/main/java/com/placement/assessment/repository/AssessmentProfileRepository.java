package com.placement.assessment.repository;

import com.placement.assessment.entity.AssessmentProfile;
import com.placement.assessment.entity.AssessmentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssessmentProfileRepository extends JpaRepository<AssessmentProfile, Long> {
    List<AssessmentProfile> findByAssessmentTypeAndActiveTrue(AssessmentType type);
    List<AssessmentProfile> findByActiveTrue();
}
