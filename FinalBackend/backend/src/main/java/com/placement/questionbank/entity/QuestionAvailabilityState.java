package com.placement.questionbank.entity;

public enum QuestionAvailabilityState {
    AVAILABLE,          // usable in mock tests / practice / interviews
    PENDING_REVIEW,      // newly synced, awaiting admin activation
    DEACTIVATED,          // admin-disabled, kept for historical attempt references
    SOURCE_UNAVAILABLE    // upstream source no longer serves it (404/removed on last sync)
}
