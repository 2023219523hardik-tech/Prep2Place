package com.placement.dto;

public class AptitudeDtos {
    public record SubmitAptitudeRequest(Long questionId, String selectedOption) {}
    public record AptitudeAttemptResponse(Long attemptId, Long questionId, String selectedOption,
                                           String correctOption, boolean correct, String explanation) {}
}
