package com.placement.assessment.entity;

/**
 * How confident the system is that a recorded event represents actual malpractice, as opposed to
 * normal behavior. AI-derived behavioral signals must never be reported to a candidate or recruiter
 * as definitive proof of cheating - see IntegrityEvent.confidenceScore and the reporting layer.
 */
public enum IntegrityEventClassification {
    DETECTED_SIGNAL,           // objectively measured browser/system event (tab switch, copy attempt, etc.)
    POTENTIAL_VIOLATION,        // AI/heuristic-derived, below high-confidence threshold
    HIGH_CONFIDENCE_VIOLATION    // AI/heuristic-derived, above configured high-confidence threshold
}
