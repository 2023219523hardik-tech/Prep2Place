package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthEvent(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull String eventType,
        @NonNull @NotNull UUID userId,
        @NonNull @NotNull String email,
        @NonNull @NotNull UUID idempotencyKey
) {
}
