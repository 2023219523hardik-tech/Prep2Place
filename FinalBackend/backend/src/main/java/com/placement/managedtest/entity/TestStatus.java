package com.placement.managedtest.entity;

/**
 * Lifecycle of an admin-built test. Only the backend performs transitions: the UI requests one and
 * ManagedTestValidationService decides whether it is legal.
 *
 * DRAFT -> PUBLISHED | SCHEDULED -> ACTIVE -> COMPLETED -> ARCHIVED
 *
 * SCHEDULED / ACTIVE / COMPLETED are derived from the availability window by
 * ManagedTestAdminService#refreshDerivedStatuses; an admin never sets them by hand.
 */
public enum TestStatus {
    DRAFT,
    PUBLISHED,
    SCHEDULED,
    ACTIVE,
    COMPLETED,
    ARCHIVED
}
