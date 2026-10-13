package com.placement.messaging;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthEvent<T> implements Serializable {
    private UUID eventId;
    private String eventType;
    private Instant timestamp;
    @JsonTypeInfo(use = JsonTypeInfo.Id.CLASS, property = "@class")
    private T payload;

    public static <T> AuthEvent<T> of(String eventType, T payload) {
        return new AuthEvent<>(UUID.randomUUID(), eventType, Instant.now(), payload);
    }

    public static final String TYPE_USER_REGISTERED = "USER_REGISTERED";
    public static final String TYPE_EMAIL_VERIFICATION_REQUESTED = "EMAIL_VERIFICATION_REQUESTED";
    public static final String TYPE_EMAIL_VERIFIED = "EMAIL_VERIFIED";
    public static final String TYPE_USER_ACTIVATED = "USER_ACTIVATED";
    public static final String TYPE_USER_LOGGED_IN = "USER_LOGGED_IN";
    public static final String TYPE_OAUTH_ACCOUNT_LINKED = "OAUTH_ACCOUNT_LINKED";

    public static final String TOPIC_AUTH_EVENTS = "auth-events";
    public static final String TOPIC_EMAIL_EVENTS = "email-events";
    public static final String TOPIC_EMAIL_EVENTS_DLT = "email-events-dlt";
}
