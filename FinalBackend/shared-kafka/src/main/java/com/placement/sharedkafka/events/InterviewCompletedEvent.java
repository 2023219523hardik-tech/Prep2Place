package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InterviewCompletedEvent(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull UUID interviewId,
        @NonNull @NotNull UUID candidateId,
        @NonNull @NotNull Long durationMs,
        @NonNull @NotNull UUID idempotencyKey
) {
}
