package com.placement.repository;

import com.placement.entity.CodingProblem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DataFrameProblemRepository extends JpaRepository<CodingProblem, Long> {

    @Query("SELECT p FROM CodingProblem p WHERE p.category = :category")
    Page<CodingProblem> findByCategory(@Param("category") String category, Pageable pageable);

    @Query("SELECT p FROM CodingProblem p WHERE p.sourceQuestionId = :sourceQuestionId AND p.category = :category")
    Optional<CodingProblem> findBySourceQuestionIdAndCategory(@Param("sourceQuestionId") String sourceQuestionId, @Param("category") String category);

    @Query("SELECT p FROM CodingProblem p WHERE p.category = :category")
    List<CodingProblem> findAllByCategory(@Param("category") String category);

    @Query("SELECT p FROM CodingProblem p WHERE p.category = :category AND p.active = true")
    Page<CodingProblem> findByCategoryAndActiveTrue(@Param("category") String category, Pageable pageable);

    @Query("SELECT p FROM CodingProblem p WHERE p.id = :id AND p.category = :category")
    Optional<CodingProblem> findByIdAndCategory(@Param("id") Long id, @Param("category") String category);

    @Query("SELECT p FROM CodingProblem p WHERE p.id = :id AND p.category = :category AND p.active = true")
    Optional<CodingProblem> findByIdAndCategoryAndActiveTrue(@Param("id") Long id, @Param("category") String category);
}
