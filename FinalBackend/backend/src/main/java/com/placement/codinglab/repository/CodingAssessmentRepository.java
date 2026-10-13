package com.placement.codinglab.repository;

import com.placement.codinglab.entity.CodingAssessment;
import com.placement.codinglab.entity.CodingAssessmentStatus;
import com.placement.codinglab.entity.CodingType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CodingAssessmentRepository extends JpaRepository<CodingAssessment, Long> {
    List<CodingAssessment> findByStatus(CodingAssessmentStatus status);
    List<CodingAssessment> findByCodingType(CodingType codingType);
    List<CodingAssessment> findByStatusAndCodingType(CodingAssessmentStatus status, CodingType codingType);
}
