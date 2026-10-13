package com.placement.questionbank.entity;

/**
 * Technical MCQ taxonomy. Stored as a string column with a CHECK constraint rather than a free-text
 * field so the admin filters, the auto-selection rules and the analytics all agree on one spelling
 * of "Operating Systems".
 *
 * Kept separate from com.placement.entity.QuestionCategory (the interview-question taxonomy) and
 * from QuestionDomain (which gates the legacy engine's CODING/APTITUDE pools).
 */
public enum TechnicalCategory {
    DSA,
    ALGORITHMS,
    OOPS,
    JAVA,
    PYTHON,
    C,
    CPP,
    DBMS,
    SQL,
    COMPUTER_NETWORKS,
    OPERATING_SYSTEMS,
    CLOUD_COMPUTING,
    AWS,
    AZURE,
    GCP,
    AI,
    MACHINE_LEARNING,
    DEEP_LEARNING,
    GENERATIVE_AI,
    DATA_SCIENCE,
    DATA_STRUCTURES,
    SYSTEM_DESIGN,
    SOFTWARE_ENGINEERING,
    COMPUTER_ARCHITECTURE,
    LINUX,
    DEVOPS,
    DOCKER,
    KUBERNETES,
    GIT_GITHUB,
    SPRING_BOOT,
    REST_API,
    MICROSERVICES,
    APTITUDE,
    LOGICAL_REASONING,
    QUANTITATIVE_APTITUDE,
    VERBAL_ABILITY;

    /** Human label for the admin UI - the enum name is the wire format, this is the display form. */
    public String label() {
        return switch (this) {
            case CPP -> "C++";
            case C -> "C";
            case OOPS -> "OOPS";
            case DBMS -> "DBMS";
            case SQL -> "SQL";
            case AI -> "AI";
            case DSA -> "DSA";
            case AWS -> "AWS";
            case GCP -> "GCP";
            case GIT_GITHUB -> "Git/GitHub";
            case REST_API -> "REST API";
            default -> {
                String[] parts = name().toLowerCase().split("_");
                StringBuilder sb = new StringBuilder();
                for (String p : parts) {
                    if (!sb.isEmpty()) sb.append(' ');
                    sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
                }
                yield sb.toString();
            }
        };
    }

    @com.fasterxml.jackson.annotation.JsonCreator
    public static TechnicalCategory fromString(String val) {
        if (val == null || val.isBlank()) return null;
        String normalized = val.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        if (normalized.equals("C++")) return CPP;
        if (normalized.equals("GIT/GITHUB") || normalized.equals("GIT")) return GIT_GITHUB;
        if (normalized.equals("REST") || normalized.equals("REST_APIS")) return REST_API;
        if (normalized.equals("SPRING") || normalized.equals("SPRINGBOOT")) return SPRING_BOOT;
        for (TechnicalCategory tc : values()) {
            if (tc.name().equalsIgnoreCase(normalized)) return tc;
        }
        for (TechnicalCategory tc : values()) {
            if (tc.name().replace("_", "").equalsIgnoreCase(normalized.replace("_", ""))) return tc;
        }
        return DSA;
    }
}
