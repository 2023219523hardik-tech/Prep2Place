package com.placement.jobs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.Certification;
import com.placement.entity.ProjectEntry;
import com.placement.entity.Skill;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.jobs.entity.JobApplication;
import com.placement.jobs.entity.JobApplicationStatus;
import com.placement.jobs.entity.JobOpportunity;
import com.placement.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AtsScoringService {

    private final StudentProfileRepository profileRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public record EligibilityResult(boolean passed, String reason) {}

    public record AtsEvaluationResult(
            double totalScore,
            double requiredSkillsScore,
            double requiredSkillsMax,
            List<String> matchedRequiredSkills,
            List<String> missingRequiredSkills,
            double preferredSkillsScore,
            double preferredSkillsMax,
            List<String> matchedPreferredSkills,
            List<String> missingPreferredSkills,
            double experienceScore,
            double experienceMax,
            double educationScore,
            double educationMax,
            double keywordScore,
            double keywordMax,
            String summary,
            String breakdownJson
    ) {}

    /**
     * Strictly evaluates mandatory academic criteria (CGPA, degree, branch, grad year, backlogs).
     */
    public EligibilityResult evaluateAcademicEligibility(StudentProfile profile, JobOpportunity job) {
        List<String> failureReasons = new ArrayList<>();

        // 1. Min CGPA Check
        if (job.getMinCgpa() != null && job.getMinCgpa() > 0) {
            if (profile == null || profile.getCgpa() == null) {
                failureReasons.add("CGPA not provided in student profile (requires min " + job.getMinCgpa() + ")");
            } else if (profile.getCgpa() < job.getMinCgpa()) {
                failureReasons.add("CGPA " + profile.getCgpa() + " is below minimum cutoff of " + job.getMinCgpa());
            }
        }

        // 2. Graduation Year Check (exact or range)
        if (job.getGraduationYear() != null && job.getGraduationYear() > 0) {
            if (profile == null || profile.getGraduationYear() == null) {
                failureReasons.add("Graduation year not provided (requires batch " + job.getGraduationYear() + ")");
            } else if (!profile.getGraduationYear().equals(job.getGraduationYear())) {
                failureReasons.add("Graduation year " + profile.getGraduationYear() + " does not match required batch " + job.getGraduationYear());
            }
        } else if (job.getMinGraduationYear() != null || job.getMaxGraduationYear() != null) {
            if (profile == null || profile.getGraduationYear() == null) {
                failureReasons.add("Graduation year not provided");
            } else {
                int grad = profile.getGraduationYear();
                if (job.getMinGraduationYear() != null && grad < job.getMinGraduationYear()) {
                    failureReasons.add("Graduation year " + grad + " is before minimum " + job.getMinGraduationYear());
                }
                if (job.getMaxGraduationYear() != null && grad > job.getMaxGraduationYear()) {
                    failureReasons.add("Graduation year " + grad + " is after maximum " + job.getMaxGraduationYear());
                }
            }
        }

        // 3. Allowed Degrees Check
        if (job.getAllowedDegrees() != null && !job.getAllowedDegrees().isBlank()) {
            List<String> allowed = parseCommaSeparated(job.getAllowedDegrees());
            if (!allowed.isEmpty()) {
                if (profile == null || profile.getDegree() == null || profile.getDegree().isBlank()) {
                    failureReasons.add("Degree not specified in student profile");
                } else {
                    String studentDegree = profile.getDegree().trim().toLowerCase();
                    boolean match = allowed.stream().anyMatch(d -> studentDegree.contains(d.toLowerCase()) || d.toLowerCase().contains(studentDegree));
                    if (!match) {
                        failureReasons.add("Degree '" + profile.getDegree() + "' not in eligible degrees (" + job.getAllowedDegrees() + ")");
                    }
                }
            }
        }

        // 4. Allowed Branches Check
        if (job.getBranches() != null && !job.getBranches().isBlank()) {
            List<String> allowed = parseCommaSeparated(job.getBranches());
            if (!allowed.isEmpty()) {
                if (profile == null || profile.getBranch() == null || profile.getBranch().isBlank()) {
                    failureReasons.add("Branch/Department not specified in student profile");
                } else {
                    String studentBranch = profile.getBranch().trim().toLowerCase();
                    boolean match = allowed.stream().anyMatch(b -> studentBranch.contains(b.toLowerCase()) || b.toLowerCase().contains(studentBranch));
                    if (!match) {
                        failureReasons.add("Branch '" + profile.getBranch() + "' not in eligible branches (" + job.getBranches() + ")");
                    }
                }
            }
        }

        if (failureReasons.isEmpty()) {
            return new EligibilityResult(true, "All mandatory academic requirements satisfied.");
        } else {
            return new EligibilityResult(false, String.join("; ", failureReasons));
        }
    }

    /**
     * Calculates candidate ATS relevance score (0 - 100) across skills, experience, education, and keywords.
     */
    public AtsEvaluationResult calculateAtsScore(String resumeText, StudentProfile profile, JobOpportunity job) {
        String cleanResume = (resumeText != null ? resumeText.toLowerCase() : "");
        Set<String> candidateSkillSet = new HashSet<>();
        if (profile != null && profile.getSkills() != null) {
            for (Skill s : profile.getSkills()) {
                if (s.getName() != null) candidateSkillSet.add(s.getName().trim().toLowerCase());
            }
        }

        // 1. Required Skills (Weight: 40 points)
        List<String> reqSkills = parseCommaSeparated(job.getRequiredSkills());
        List<String> matchedReq = new ArrayList<>();
        List<String> missingReq = new ArrayList<>();
        double reqSkillsMax = 40.0;
        double reqSkillsScore = 0.0;

        if (reqSkills.isEmpty()) {
            reqSkillsScore = 40.0; // No required skills specified -> full credit
        } else {
            for (String skill : reqSkills) {
                String sk = skill.trim();
                if (containsSkill(cleanResume, candidateSkillSet, sk)) {
                    matchedReq.add(sk);
                } else {
                    missingReq.add(sk);
                }
            }
            reqSkillsScore = Math.round(((double) matchedReq.size() / reqSkills.size()) * reqSkillsMax * 10.0) / 10.0;
        }

        // 2. Preferred / Nice to Have Skills (Weight: 15 points)
        List<String> prefSkills = parseCommaSeparated(job.getNiceToHaveSkills());
        List<String> matchedPref = new ArrayList<>();
        List<String> missingPref = new ArrayList<>();
        double prefSkillsMax = 15.0;
        double prefSkillsScore = 0.0;

        if (prefSkills.isEmpty()) {
            prefSkillsScore = 15.0;
        } else {
            for (String skill : prefSkills) {
                String sk = skill.trim();
                if (containsSkill(cleanResume, candidateSkillSet, sk)) {
                    matchedPref.add(sk);
                } else {
                    missingPref.add(sk);
                }
            }
            prefSkillsScore = Math.round(((double) matchedPref.size() / prefSkills.size()) * prefSkillsMax * 10.0) / 10.0;
        }

        // 3. Experience & Projects Alignment (Weight: 20 points)
        double expMax = 20.0;
        double expScore = 0.0;
        int projectCount = (profile != null && profile.getProjects() != null) ? profile.getProjects().size() : 0;
        int resumeProjectKeywords = countOccurrences(cleanResume, "project", "developed", "built", "implemented", "architecture", "system", "api", "database", "full stack", "frontend", "backend");
        
        if (projectCount >= 3 || resumeProjectKeywords >= 8) {
            expScore = 20.0;
        } else if (projectCount >= 2 || resumeProjectKeywords >= 5) {
            expScore = 16.0;
        } else if (projectCount >= 1 || resumeProjectKeywords >= 2) {
            expScore = 12.0;
        } else {
            expScore = 6.0;
        }

        // 4. Education & Certifications (Weight: 15 points)
        double eduMax = 15.0;
        double eduScore = 7.0; // baseline for valid candidate
        if (profile != null && profile.getCgpa() != null) {
            if (profile.getCgpa() >= 8.5) eduScore += 5.0;
            else if (profile.getCgpa() >= 7.5) eduScore += 3.5;
            else if (profile.getCgpa() >= 6.5) eduScore += 2.0;
        } else {
            eduScore += 3.0;
        }
        int certCount = (profile != null && profile.getCertifications() != null) ? profile.getCertifications().size() : 0;
        if (certCount >= 2 || containsAny(cleanResume, "certified", "certification", "aws certified", "nptel", "coursera", "udemy")) {
            eduScore += 3.0;
        } else if (certCount >= 1) {
            eduScore += 1.5;
        }
        eduScore = Math.min(eduMax, Math.round(eduScore * 10.0) / 10.0);

        // 5. Job Description & Responsibilities Keyword Density (Weight: 10 points)
        double kwMax = 10.0;
        double kwScore = 0.0;
        List<String> jdKeywords = extractKeyTerms(job.getDescription(), job.getResponsibilities());
        if (jdKeywords.isEmpty()) {
            kwScore = 10.0;
        } else {
            int hits = 0;
            for (String kw : jdKeywords) {
                if (cleanResume.contains(kw.toLowerCase())) hits++;
            }
            kwScore = Math.round(((double) hits / jdKeywords.size()) * kwMax * 10.0) / 10.0;
        }

        double total = Math.min(100.0, Math.round((reqSkillsScore + prefSkillsScore + expScore + eduScore + kwScore) * 10.0) / 10.0);

        String summary = String.format("ATS Score: %.1f%% • Matched %d/%d Required Skills, %d/%d Preferred Skills • Academic Alignment: %.1f/15",
                total, matchedReq.size(), reqSkills.size(), matchedPref.size(), prefSkills.size(), eduScore);

        Map<String, Object> breakdownMap = new LinkedHashMap<>();
        breakdownMap.put("totalScore", total);
        breakdownMap.put("requiredSkillsScore", reqSkillsScore);
        breakdownMap.put("requiredSkillsMax", reqSkillsMax);
        breakdownMap.put("matchedRequiredSkills", matchedReq);
        breakdownMap.put("missingRequiredSkills", missingReq);
        breakdownMap.put("preferredSkillsScore", prefSkillsScore);
        breakdownMap.put("preferredSkillsMax", prefSkillsMax);
        breakdownMap.put("matchedPreferredSkills", matchedPref);
        breakdownMap.put("missingPreferredSkills", missingPref);
        breakdownMap.put("experienceScore", expScore);
        breakdownMap.put("experienceMax", expMax);
        breakdownMap.put("educationScore", eduScore);
        breakdownMap.put("educationMax", eduMax);
        breakdownMap.put("keywordScore", kwScore);
        breakdownMap.put("keywordMax", kwMax);
        breakdownMap.put("summary", summary);

        String breakdownJson = "{}";
        try {
            breakdownJson = objectMapper.writeValueAsString(breakdownMap);
        } catch (Exception e) {
            log.error("Failed to serialize ATS breakdown JSON", e);
        }

        return new AtsEvaluationResult(
                total,
                reqSkillsScore,
                reqSkillsMax,
                matchedReq,
                missingReq,
                prefSkillsScore,
                prefSkillsMax,
                matchedPref,
                missingPref,
                expScore,
                expMax,
                eduScore,
                eduMax,
                kwScore,
                kwMax,
                summary,
                breakdownJson
        );
    }

    /**
     * Executes end-to-end ATS parsing, academic evaluation, and configurable shortlisting for an application.
     */
    public void evaluateApplication(JobApplication app, JobOpportunity job, User candidate) {
        StudentProfile profile = profileRepository.findByUserId(candidate.getId()).orElse(null);
        String resumeText = app.getResumeText();
        if ((resumeText == null || resumeText.isBlank()) && profile != null) {
            resumeText = profile.getResumeText();
            app.setResumeText(resumeText);
        }

        // 1. Mandatory Academic Eligibility
        EligibilityResult eligibility = evaluateAcademicEligibility(profile, job);
        app.setEligibilityPassed(eligibility.passed());
        app.setEligibilityFailureReason(eligibility.passed() ? null : eligibility.reason());

        // 2. ATS Relevance Score Calculation
        AtsEvaluationResult atsResult = calculateAtsScore(resumeText, profile, job);
        app.setAtsScore(atsResult.totalScore());
        app.setAtsScoreBreakdown(atsResult.breakdownJson());
        app.setAtsParsingStatus("PARSED");

        double cutoff = (job.getAtsMinimumScore() != null) ? job.getAtsMinimumScore() : 75.0;

        // 3. Configurable Shortlisting Decision
        if (!job.isAtsScreeningEnabled()) {
            // ATS disabled: application accepted for review
            app.setStatus(JobApplicationStatus.APPLIED);
            return;
        }

        if (!eligibility.passed()) {
            // Academic criteria failed - never auto-shortlist
            if (job.isManualReviewRequired()) {
                app.setStatus(JobApplicationStatus.UNDER_REVIEW);
                app.setRecruiterAuditNotes("Flagged: Mandatory academic eligibility failed (" + eligibility.reason() + ") - Pending recruiter manual review.");
            } else {
                app.setStatus(JobApplicationStatus.NOT_ELIGIBLE);
                app.setFinalDecision("INELIGIBLE");
                app.setRecruiterAuditNotes("Disqualified by automated eligibility check: " + eligibility.reason());
            }
            return;
        }

        // Eligibility passed, evaluate ATS score vs configurable cutoff
        if (atsResult.totalScore() >= cutoff) {
            if (job.isAutoShortlistEnabled() && !job.isManualReviewRequired()) {
                app.setStatus(JobApplicationStatus.SHORTLISTED);
                app.setRecruiterAuditNotes("Auto-shortlisted: ATS score " + atsResult.totalScore() + "% meets cutoff " + cutoff + "%.");
            } else {
                app.setStatus(JobApplicationStatus.UNDER_REVIEW);
                app.setRecruiterAuditNotes("Qualified (" + atsResult.totalScore() + "% >= " + cutoff + "%) - Awaiting recruiter confirmation.");
            }
        } else {
            // Below configured cutoff
            if (job.isManualReviewRequired()) {
                app.setStatus(JobApplicationStatus.UNDER_REVIEW);
                app.setRecruiterAuditNotes("Below cutoff (" + atsResult.totalScore() + "% < " + cutoff + "%) - Moved to manual review queue.");
            } else {
                app.setStatus(JobApplicationStatus.REJECTED);
                app.setFinalDecision("REJECTED");
                app.setRecruiterAuditNotes("Rejected by automated screening: ATS score " + atsResult.totalScore() + "% is below configured threshold of " + cutoff + "%.");
            }
        }
    }

    private boolean containsSkill(String resume, Set<String> profileSkills, String skill) {
        String s = skill.toLowerCase().trim();
        if (profileSkills.contains(s)) return true;
        for (String ps : profileSkills) {
            if (ps.contains(s) || s.contains(ps)) return true;
        }
        if (resume.isBlank()) return false;
        // Word boundary match
        Pattern p = Pattern.compile("\\b" + Pattern.quote(s) + "\\b", Pattern.CASE_INSENSITIVE);
        return p.matcher(resume).find();
    }

    private List<String> parseCommaSeparated(String text) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        return Arrays.stream(text.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }

    private int countOccurrences(String text, String... words) {
        int count = 0;
        for (String w : words) {
            if (text.contains(w.toLowerCase())) count++;
        }
        return count;
    }

    private boolean containsAny(String text, String... words) {
        for (String w : words) {
            if (text.contains(w.toLowerCase())) return true;
        }
        return false;
    }

    private List<String> extractKeyTerms(String desc, String resp) {
        String combined = (desc != null ? desc : "") + " " + (resp != null ? resp : "");
        if (combined.isBlank()) return Collections.emptyList();
        // Sample core technical keywords to check
        String[] pool = {
                "rest api", "microservices", "sql", "nosql", "git", "ci/cd", "agile",
                "unit testing", "data structures", "algorithms", "problem solving",
                "clean code", "system design", "docker", "cloud", "aws", "azure"
        };
        List<String> list = new ArrayList<>();
        String lower = combined.toLowerCase();
        for (String p : pool) {
            if (lower.contains(p)) list.add(p);
        }
        return list;
    }
}
