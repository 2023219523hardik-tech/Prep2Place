package com.placement.sharedkafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.NonNull;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record QuestionImported(
        @NonNull @NotNull UUID eventId,
        @NonNull @NotNull Instant timestamp,
        @NonNull @NotNull String sourceService,
        @NonNull @NotNull Long questionId,
        @NonNull @NotNull String category,
        @NonNull @NotNull UUID idempotencyKey
) {
}
