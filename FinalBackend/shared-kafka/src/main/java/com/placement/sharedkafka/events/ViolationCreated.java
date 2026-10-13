package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ViolationCreated(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull UUID attemptId,
        @NonNull @NotNull UUID studentId,
        @NonNull @NotNull String violationType,
        @NonNull @NotNull String severity,
        @NonNull @NotNull String details,
        @NonNull @NotNull UUID idempotencyKey
) {
}
