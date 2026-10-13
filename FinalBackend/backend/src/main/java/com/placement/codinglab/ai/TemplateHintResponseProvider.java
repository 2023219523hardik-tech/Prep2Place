package com.placement.codinglab.ai;

import com.placement.codinglab.entity.AiHintClassification;
import com.placement.codinglab.entity.AiHintResponseType;
import com.placement.codinglab.entity.CodingType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Default {@link AiHintResponseProvider}: deterministic, template-based, and works with zero
 * external dependencies or API keys - so the AI Hint Assistant is usable out of the box. No LLM
 * integration exists anywhere else in this codebase yet (checked before writing this), so rather
 * than bolt on a brand-new external API dependency that can't be exercised or verified in this
 * environment, this implements the "MAY do" list (Section 15) directly: concept explanations,
 * error-message interpretation, and guiding questions, keyed by coding type and simple keyword
 * spotting in the student's message/error. A production deployment can register a second
 * {@link AiHintResponseProvider} bean (e.g. backed by a real LLM with the same restricted system
 * prompt) and swap it in via {@code @Primary}/{@code @ConditionalOnProperty} without changing
 * {@code AiHintService} or the guardrail layer that runs in front of every provider.
 */
@Component
public class TemplateHintResponseProvider implements AiHintResponseProvider {

    private static final Map<CodingType, String> LAYER_BREAKDOWNS = Map.of(
            CodingType.BACKEND, "1. Request validation\n2. Business logic\n3. Persistence\n4. Response handling",
            CodingType.FRONTEND, "1. Component structure\n2. State/data flow\n3. API integration\n4. Rendering/UI",
            CodingType.MACHINE_LEARNING, "1. Data loading/cleaning\n2. Feature engineering\n3. Model choice/training\n4. Evaluation",
            CodingType.AI, "1. Input processing\n2. Model/inference call\n3. Post-processing\n4. Evaluation",
            CodingType.GENERATIVE_AI, "1. Prompt/context construction\n2. Model call\n3. Structured output handling\n4. Evaluation/guardrails",
            CodingType.RAG, "documents -> chunks -> embeddings -> retrieval -> context -> generation"
    );

    private static final Pattern[] ERROR_PATTERNS = {
            Pattern.compile("NullPointerException"),
            Pattern.compile("ClassNotFoundException|NoClassDefFoundError"),
            Pattern.compile("cannot find symbol|does not exist"),
            Pattern.compile("SyntaxError"),
            Pattern.compile("IndentationError"),
            Pattern.compile("ModuleNotFoundError|ImportError"),
            Pattern.compile("TypeError"),
            Pattern.compile("undefined is not a function|Cannot read propert(y|ies)"),
            Pattern.compile("ConnectionRefused|Address already in use"),
            Pattern.compile("AssertionError|assert"),
            Pattern.compile("Tests run:.*Failures:\\s*[1-9]|Failures:\\s*[1-9]"),
    };

    @Override
    public HintResponse respond(HintContext ctx) {
        if (ctx.classification() == AiHintClassification.RESTRICTED_SOLVE_REQUEST) {
            return refusal(ctx);
        }
        if (ctx.lastError() != null && !ctx.lastError().isBlank()) {
            HintResponse explanation = explainError(ctx);
            if (explanation != null) return explanation;
        }
        return conceptualHint(ctx);
    }

    private HintResponse refusal(HintContext ctx) {
        String breakdown = LAYER_BREAKDOWNS.getOrDefault(ctx.codingType(), "Break the problem into its main stages first.");
        String text = "I can't provide the complete solution for an active assessment.\n\n"
                + "Think about the problem as:\n" + breakdown
                + "\n\nWhich part have you implemented so far, and what's blocking you there?";
        return new HintResponse(AiHintResponseType.REFUSAL, text);
    }

    private HintResponse explainError(HintContext ctx) {
        String error = ctx.lastError();
        for (Pattern p : ERROR_PATTERNS) {
            Matcher m = p.matcher(error);
            if (m.find()) {
                String tip = tipForPattern(p);
                String text = "That error looks like it involves: " + summarizeErrorLine(error)
                        + "\n\n" + tip
                        + "\n\nWhat does the line the error points to actually do?";
                return new HintResponse(AiHintResponseType.ERROR_EXPLANATION, text);
            }
        }
        return null;
    }

    private String tipForPattern(Pattern p) {
        String pattern = p.pattern();
        if (pattern.contains("NullPointerException")) {
            return "Something you're calling a method/field on is null at runtime. Trace back to where that "
                    + "value should have been set - was it ever assigned, or does a conditional path skip it?";
        }
        if (pattern.contains("ClassNotFoundException")) {
            return "A class the code references isn't on the classpath at runtime. Check the package/import "
                    + "path matches exactly, and that the dependency providing it is declared.";
        }
        if (pattern.contains("cannot find symbol")) {
            return "The compiler can't resolve a name - check spelling, imports, and that the member is "
                    + "actually declared with that visibility on that type.";
        }
        if (pattern.contains("SyntaxError")) {
            return "There's a structural issue in the code (missing colon/bracket/indent, mismatched "
                    + "parens). Check the line just before the one reported - syntax errors often point one "
                    + "line past the actual problem.";
        }
        if (pattern.contains("IndentationError")) {
            return "Python is whitespace-sensitive - check that this block uses a consistent number of "
                    + "spaces (not mixed tabs/spaces) relative to its enclosing block.";
        }
        if (pattern.contains("ModuleNotFoundError")) {
            return "A package isn't installed/importable in this environment - check the import name matches "
                    + "the package name and it's declared as a dependency.";
        }
        if (pattern.contains("TypeError")) {
            return "You're calling something with a value of the wrong shape/type. Log the value right "
                    + "before the failing line to see what it actually is versus what you expect.";
        }
        if (pattern.contains("undefined is not a function")) {
            return "You're calling a method on something that's undefined/null at that point, or the object "
                    + "doesn't have that method. Check what the value actually is right before that call.";
        }
        if (pattern.contains("ConnectionRefused")) {
            return "Something is trying to reach a service/port that isn't up (or a port collision). Check "
                    + "what your code is trying to connect to and whether it's actually running in this sandbox.";
        }
        if (pattern.contains("AssertionError")) {
            return "A test's expectation didn't match the actual output. Compare the expected vs actual "
                    + "value in the failure message carefully - the difference usually tells you exactly "
                    + "which case you're not handling.";
        }
        return "Re-read the failure message carefully - it usually names the exact file/line and what went wrong.";
    }

    private String summarizeErrorLine(String error) {
        String firstLine = error.strip().split("\n", 2)[0];
        return firstLine.length() > 160 ? firstLine.substring(0, 160) + "..." : firstLine;
    }

    private static final Map<String, String> KEYWORD_TIPS = new LinkedHashMap<>() {{
        put("f1", "Check class distribution first. Compare precision and recall separately, and verify "
                + "your validation split represents the class distribution.");
        put("precision", "Precision and recall trade off against each other - check your decision threshold, "
                + "not just the model itself.");
        put("overfit", "Compare training vs validation metrics. A big gap between them is the usual signal, "
                + "and regularization/more data are the usual first levers.");
        put("retriev", "Check what your retriever actually returns for a known query before touching "
                + "generation - is the relevant chunk even in the top-k?");
        put("chunk", "Chunk size and overlap both affect retrieval quality - too large loses precision, too "
                + "small loses context. What sizes have you tried?");
        put("embedding", "Confirm the same embedding model/dimensionality is used for both indexing and "
                + "querying - a mismatch there silently breaks similarity search.");
        put("pagination", "Think about what the client needs to know to request the next page - a page "
                + "size/offset, or a cursor - and where that state should live.");
        put("authentication", "Separate 'who is this' (authentication) from 'are they allowed to do this' "
                + "(authorization) - which one is actually failing in your case?");
        put("cors", "CORS errors come from the browser, not your server - check the response headers your "
                + "backend actually sends for that origin/method.");
        put("state management", "Trace where the value is set, where it's read, and whether the update "
                + "actually triggers a re-render - which of those three is missing?");
        put("test", "Run the public tests one at a time and read the first failure's assertion message "
                + "closely before changing anything else.");
    }};

    private HintResponse conceptualHint(HintContext ctx) {
        String haystack = (safe(ctx.studentMessage()) + " " + safe(ctx.assessmentDescription())).toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> entry : KEYWORD_TIPS.entrySet()) {
            if (haystack.contains(entry.getKey())) {
                return new HintResponse(AiHintResponseType.HINT,
                        entry.getValue() + "\n\nWhat have you tried so far, and what did you observe?");
            }
        }
        String breakdown = LAYER_BREAKDOWNS.getOrDefault(ctx.codingType(), "input -> processing -> output");
        return new HintResponse(AiHintResponseType.HINT,
                "Try breaking it down as:\n" + breakdown
                        + "\n\nWhich stage are you currently working on, and what's the specific behavior "
                        + "you're seeing versus what you expect?");
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
