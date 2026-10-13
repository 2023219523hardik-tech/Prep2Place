package com.placement.messaging.payload;

import java.io.Serializable;
import java.time.Instant;

public class EventPayloads {

    public record UserRegistered(Long userId, String email, Instant timestamp) implements Serializable {}
    public record EmailVerificationRequested(Long userId, String email, Instant timestamp) implements Serializable {}
    public record EmailVerified(Long userId, String email, Instant timestamp) implements Serializable {}
    public record UserActivated(Long userId, String email, Instant timestamp) implements Serializable {}
    public record UserLoggedIn(Long userId, String email, Instant timestamp) implements Serializable {}
    public record OAuthAccountLinked(Long userId, String provider, String providerAccountId, Instant timestamp) implements Serializable {}
}
