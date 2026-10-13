package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AttemptStarted(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull UUID attemptId,
        @NonNull @NotNull UUID studentId,
        @NonNull @NotNull UUID testId,
        @NonNull @NotNull UUID idempotencyKey
) {
}
