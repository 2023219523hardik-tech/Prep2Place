package com.placement.codinglab.model;

import com.placement.codinglab.entity.CodingDifficulty;
import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * The single, portable description of a question. It is the LLM's output schema, the seed-file format,
 * the import/export format and what the validator + verifier operate on - so a question is treated
 * identically no matter how it was created.
 *
 * <p>File-layout contract (enforced by {@code AssessmentContentValidator}):
 * starterFiles/referenceFiles live anywhere except {@code tests/}; publicTestFiles must be under
 * {@code tests/public/}; hiddenTestFiles under {@code tests/hidden/}.
 */
public record AssessmentBlueprint(
        String title,
        CodingType codingType,
        CodingDifficulty difficulty,
        CodingRuntime runtime,
        String summary,
        String problemStatement,
        List<RequirementSpec> requirements,
        Map<String, String> starterFiles,
        Map<String, String> publicTestFiles,
        Map<String, String> hiddenTestFiles,
        Map<String, String> referenceFiles,
        Integer timeLimitMinutes,
        String technology,
        String targetJobRole,
        List<String> skills,
        List<String> tags) {

    public List<RequirementSpec> requirementsOrEmpty() { return requirements == null ? List.of() : requirements; }

    public Map<String, String> starter() { return starterFiles == null ? Map.of() : starterFiles; }

    public Map<String, String> publicTests() { return publicTestFiles == null ? Map.of() : publicTestFiles; }

    public Map<String, String> hiddenTests() { return hiddenTestFiles == null ? Map.of() : hiddenTestFiles; }

    public Map<String, String> reference() { return referenceFiles == null ? Map.of() : referenceFiles; }

    /** Everything that changes what the sandbox runs. Cosmetic edits (title, wording) keep a verification valid. */
    public String contentHash() {
        StringBuilder sb = new StringBuilder();
        sb.append("v1|").append(runtime).append('|').append(codingType).append('\n');
        requirementsOrEmpty().stream().sorted(Comparator.comparing(r -> String.valueOf(r.id())))
                .forEach(r -> sb.append("req:").append(r.id()).append('=').append(r.weightOrDefault()).append('\n'));
        appendFiles(sb, "starter", starter());
        appendFiles(sb, "public", publicTests());
        appendFiles(sb, "hidden", hiddenTests());
        appendFiles(sb, "reference", reference());
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void appendFiles(StringBuilder sb, String tag, Map<String, String> files) {
        new TreeMap<>(files).forEach((k, v) -> sb.append(tag).append(':').append(k).append('\u0000')
                .append(v == null ? "" : v).append('\u0001'));
    }
}
