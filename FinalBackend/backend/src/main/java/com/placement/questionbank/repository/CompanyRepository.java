package com.placement.questionbank.repository;

import com.placement.questionbank.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findBySlugIgnoreCase(String slug);

    List<Company> findAll();
}
