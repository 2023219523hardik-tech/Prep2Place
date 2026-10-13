package com.placement.managedtest.repository;

import com.placement.managedtest.entity.ManagedTestSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ManagedTestSectionRepository extends JpaRepository<ManagedTestSection, Long> {

    List<ManagedTestSection> findByTestIdOrderByDisplayOrderAsc(Long testId);

    /** Fetch-joins the questions so section rendering is a single query, not one per section. */
    @Query("select distinct s from ManagedTestSection s left join fetch s.questions where s.test.id = :testId order by s.displayOrder")
    List<ManagedTestSection> findWithQuestionsByTestId(@Param("testId") Long testId);

    long countByTestId(Long testId);
}
