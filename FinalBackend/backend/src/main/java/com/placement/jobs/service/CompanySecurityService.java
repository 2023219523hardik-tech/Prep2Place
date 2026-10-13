package com.placement.jobs.service;

import com.placement.entity.Role;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.jobs.entity.JobOpportunity;
import com.placement.jobs.repository.JobOpportunityRepository;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.repository.CompanyRepository;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanySecurityService {

    private final CurrentUserService currentUserService;
    private final CompanyRepository companyRepository;
    private final JobOpportunityRepository jobRepository;

    /**
     * Resolves the company entity by slug or throws 404.
     */
    public Company getCompanyBySlug(String companySlug) {
        if (companySlug == null || companySlug.isBlank()) {
            throw ApiException.badRequest("Company slug is required");
        }
        return companyRepository.findBySlugIgnoreCase(companySlug.trim())
                .orElseThrow(() -> ApiException.notFound("Company not found: " + companySlug));
    }

    /**
     * Verifies that the authenticated user is either a platform ADMIN or a COMPANY_ADMIN
     * assigned explicitly to the company with slug companySlug.
     * Throws 403 Forbidden if the user tries to access a different company's resources.
     */
    public Company validateCompanyAdminAccess(String companySlug) {
        User user = currentUserService.getCurrentUser();
        Company targetCompany = getCompanyBySlug(companySlug);

        // Platform ADMIN has overarching management access
        if (user.getRole() == Role.ADMIN) {
            return targetCompany;
        }

        // COMPANY_ADMIN must belong to target company
        if (user.getRole() == Role.COMPANY_ADMIN) {
            Company userCompany = user.getCompany();
            if (userCompany == null) {
                log.warn("Security rejection: User {} has COMPANY_ADMIN role but no company assigned", user.getEmail());
                throw ApiException.forbidden("No company assigned to this administrator account");
            }

            if (!userCompany.getSlug().equalsIgnoreCase(targetCompany.getSlug())
                    && !userCompany.getId().equals(targetCompany.getId())) {
                log.warn("Security violation attempt: User {} (Company: {}) tried to access Company: {}",
                        user.getEmail(), userCompany.getSlug(), companySlug);
                throw ApiException.forbidden("Access denied: You do not have permissions for company: " + companySlug);
            }

            return targetCompany;
        }

        log.warn("Security rejection: User {} with role {} attempted company admin access", user.getEmail(), user.getRole());
        throw ApiException.forbidden("Company Admin privileges required");
    }

    /**
     * Validates that the specified job belongs to the target company.
     */
    public JobOpportunity validateJobOwnership(String companySlug, Long jobId) {
        Company company = validateCompanyAdminAccess(companySlug);
        JobOpportunity job = jobRepository.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job opportunity not found: " + jobId));

        boolean matchesRef = job.getCompanyRef() != null &&
                (job.getCompanyRef().getId().equals(company.getId()) ||
                 job.getCompanyRef().getSlug().equalsIgnoreCase(company.getSlug()));
        boolean matchesName = job.getCompany() != null &&
                job.getCompany().trim().equalsIgnoreCase(company.getName().trim());

        if (!matchesRef && !matchesName) {
            log.warn("Security violation attempt: Company {} tried to manage job {} belonging to {}",
                    companySlug, jobId, job.getCompany());
            throw ApiException.forbidden("This job posting does not belong to your company");
        }

        return job;
    }
}
