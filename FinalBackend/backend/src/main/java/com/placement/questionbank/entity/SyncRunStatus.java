package com.placement.questionbank.entity;

public enum SyncRunStatus {
    RUNNING,
    SUCCESS,
    PARTIAL_FAILURE, // some questions synced, some failed
    FAILED,          // source unreachable / auth failure / timeout after retries
    SKIPPED_DISABLED
}
