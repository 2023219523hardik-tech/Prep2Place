package com.placement.dto;

import java.util.List;

public class AdminDtos {
    public record AdminLoginRequest(String email, String password) {}
    public record AdminStatsResponse(long totalStudents, long activeStudents, long placementReadyStudents,
                                      long studentsNeedingImprovement, double averageReadinessScore,
                                      double averageCodingScore, double averageAptitudeScore, double averageInterviewScore,
                                      List<String> mostCommonSkillGaps) {}
    public record CreateQuestionRequest(String text, String category, String difficulty, Long roleId, String expectedKeywords) {}
    public record BulkQuestionUploadRequest(List<CreateQuestionRequest> questions) {}
    /** Full create/update payload for a single aptitude MCQ. Every write goes through
     *  AdminService's validate() + full-overwrite, same reasoning as TechnicalMcqUpsertRequest:
     *  options and correctOption are one coherent unit, so this is not a partial-merge PATCH. */
    public record AptitudeQuestionUpsertRequest(String text, String topic, String difficulty,
            String optionA, String optionB, String optionC, String optionD,
            String correctOption, String explanation) {}
    public record CreateJobRoleRequest(String title, String domain, String description, String requiredSkills) {}
    public record UpdateStudentStatusRequest(Boolean active) {}
    public record ScoreWeightConfigRequest(Double correctnessWeight, Double clarityWeight, Double confidenceWeight,
                                            Double structureWeight, Double depthWeight, Double dsaWeight,
                                            Double aptitudeWeight, Double technicalWeight, Double communicationWeight,
                                            Double interviewWeight, Double projectsWeight, Double academicsWeight) {}
    public record FlaggedInterviewResponse(Long sessionId, String studentName, String studentEmail,
                                            String roleTitle, Double integrityScore, String completedAt) {}
    public record PageResponse<T>(List<T> content, int number, int size, long totalElements, int totalPages, boolean first, boolean last) {}
}