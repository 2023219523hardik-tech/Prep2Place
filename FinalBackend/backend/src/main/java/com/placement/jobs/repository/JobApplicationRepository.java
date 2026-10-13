package com.placement.jobs.repository;

import com.placement.jobs.entity.JobApplication;
import com.placement.jobs.entity.JobApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    Optional<JobApplication> findByJobIdAndApplicantId(Long jobId, Long applicantId);

    boolean existsByJobIdAndApplicantId(Long jobId, Long applicantId);

    Page<JobApplication> findByApplicantIdOrderByAppliedAtDesc(Long applicantId, Pageable pageable);

    Page<JobApplication> findByJobIdOrderByAppliedAtDesc(Long jobId, Pageable pageable);

    @Query("SELECT a FROM JobApplication a WHERE a.job.id = :jobId " +
            "AND (:status IS NULL OR a.status = :status) ORDER BY a.appliedAt DESC")
    Page<JobApplication> findByJobIdAndStatus(@Param("jobId") Long jobId,
                                              @Param("status") JobApplicationStatus status,
                                              Pageable pageable);

    long countByJobId(Long jobId);

    List<JobApplication> findByJobId(Long jobId);

    @Query("SELECT a FROM JobApplication a WHERE (a.job.companyRef.id = :companyId OR LOWER(a.job.company) = LOWER(:companyName)) " +
            "AND (:jobId IS NULL OR a.job.id = :jobId) " +
            "AND (:status IS NULL OR a.status = :status) " +
            "ORDER BY a.appliedAt DESC")
    Page<JobApplication> findByCompanyAndFilters(@Param("companyId") Long companyId,
                                                @Param("companyName") String companyName,
                                                @Param("jobId") Long jobId,
                                                @Param("status") JobApplicationStatus status,
                                                Pageable pageable);

    @Query("SELECT a FROM JobApplication a WHERE (a.job.companyRef.id = :companyId OR LOWER(a.job.company) = LOWER(:companyName)) " +
            "AND (:search IS NULL OR :search = '' OR LOWER(a.applicant.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(a.applicant.email) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY a.appliedAt DESC")
    Page<JobApplication> searchCandidatesByCompany(@Param("companyId") Long companyId,
                                                   @Param("companyName") String companyName,
                                                   @Param("search") String search,
                                                   Pageable pageable);

    @Query("SELECT COUNT(a) FROM JobApplication a WHERE (a.job.companyRef.id = :companyId OR LOWER(a.job.company) = LOWER(:companyName))")
    long countByCompany(@Param("companyId") Long companyId, @Param("companyName") String companyName);

    @Query("SELECT COUNT(a) FROM JobApplication a WHERE (a.job.companyRef.id = :companyId OR LOWER(a.job.company) = LOWER(:companyName)) AND a.status = :status")
    long countByCompanyAndStatus(@Param("companyId") Long companyId, @Param("companyName") String companyName, @Param("status") JobApplicationStatus status);
}
