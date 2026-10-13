package com.placement.controller;

import com.placement.exception.ApiException;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyRepository companyRepository;

    @GetMapping
    public List<Company> getAllCompanies() {
        return companyRepository.findAll();
    }

    @GetMapping("/{id}")
    public Company getCompanyById(@PathVariable Long id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Company not found with id: " + id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Company> createCompany(@RequestBody Company company) {
        Company saved = companyRepository.save(company);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Company updateCompany(@PathVariable Long id, @RequestBody Company companyDetails) {
        Company existing = companyRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Company not found with id: " + id));

        if (companyDetails.getSlug() != null) existing.setSlug(companyDetails.getSlug());
        if (companyDetails.getName() != null) existing.setName(companyDetails.getName());
        if (companyDetails.getTotalDistinctAvailable() != null) existing.setTotalDistinctAvailable(companyDetails.getTotalDistinctAvailable());
        if (companyDetails.getIncludedInSheet() != null) existing.setIncludedInSheet(companyDetails.getIncludedInSheet());
        if (companyDetails.getCapped() != null) existing.setCapped(companyDetails.getCapped());

        return companyRepository.save(existing);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCompany(@PathVariable Long id) {
        if (!companyRepository.existsById(id)) {
            throw ApiException.notFound("Company not found with id: " + id);
        }
        companyRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
