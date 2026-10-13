package com.placement.jobs.repository;

import com.placement.jobs.entity.JobOpportunity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobOpportunityRepository extends JpaRepository<JobOpportunity, Long> {

    @Query("SELECT j FROM JobOpportunity j WHERE j.active = true " +
            "AND (j.closesAt IS NULL OR j.closesAt >= CURRENT_DATE) " +
            "AND (:search IS NULL OR :search = '' OR LOWER(j.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(j.company) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:employmentType IS NULL OR :employmentType = '' OR j.employmentType = :employmentType) " +
            "AND (:experienceLevel IS NULL OR :experienceLevel = '' OR j.experienceLevel = :experienceLevel) " +
            "ORDER BY j.postedAt DESC")
    Page<JobOpportunity> searchActive(@Param("search") String search,
                                      @Param("employmentType") String employmentType,
                                      @Param("experienceLevel") String experienceLevel,
                                      Pageable pageable);

    @Query("SELECT j FROM JobOpportunity j WHERE " +
            "(:search IS NULL OR :search = '' OR LOWER(j.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(j.company) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:active IS NULL OR j.active = :active) " +
            "ORDER BY j.postedAt DESC")
    Page<JobOpportunity> searchAdmin(@Param("search") String search,
                                     @Param("active") Boolean active,
                                     Pageable pageable);

    @Query("SELECT j FROM JobOpportunity j WHERE " +
            "(j.companyRef.id = :companyId OR LOWER(j.company) = LOWER(:companyName)) " +
            "AND (:search IS NULL OR :search = '' OR LOWER(j.title) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "AND (:status IS NULL OR :status = '' OR j.status = :status) " +
            "ORDER BY j.postedAt DESC")
    Page<JobOpportunity> searchByCompany(@Param("companyId") Long companyId,
                                         @Param("companyName") String companyName,
                                         @Param("search") String search,
                                         @Param("status") String status,
                                         Pageable pageable);

    long countByCompanyRefId(Long companyId);
    long countByCompanyRefIdAndActiveTrue(Long companyId);
    long countByCompanyRefIdAndStatus(Long companyId, String status);
}
