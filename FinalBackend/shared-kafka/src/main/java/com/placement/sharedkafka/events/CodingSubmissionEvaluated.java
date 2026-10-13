package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CodingSubmissionEvaluated(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull Long submissionId,
        @NonNull @NotNull Long problemId,
        @NonNull @NotNull UUID studentId,
        @NonNull @NotNull String category,
        @NonNull @NotNull Double score,
        @NonNull @NotNull UUID idempotencyKey
) {
}
