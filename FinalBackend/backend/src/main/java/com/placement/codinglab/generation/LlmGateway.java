package com.placement.codinglab.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

/**
 * Minimal, dependency-free LLM client used for question generation (via the JDK HttpClient + Jackson, both
 * already on the classpath). Two wire formats cover essentially every provider:
 * <ul>
 *   <li>{@code anthropic} - Anthropic Messages API;</li>
 *   <li>{@code openai} - any OpenAI-compatible {@code /chat/completions} endpoint (OpenAI, Groq, Google Gemini's
 *       OpenAI-compatible endpoint, OpenRouter, Ollama, ...).</li>
 * </ul>
 * With {@code app.llm.provider=none} (the default) generation endpoints answer with a clear "not configured"
 * message instead of failing obscurely. The API key is read from configuration only and never logged/returned.
 */
@Component
public class LlmGateway {

    private final String provider;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final int maxTokens;
    private final String maxTokensParam;
    private final Double temperature;
    private final int timeoutSeconds;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public LlmGateway(
            @Value("${app.llm.provider:none}") String provider,
            @Value("${app.llm.base-url:}") String baseUrl,
            @Value("${app.llm.api-key:}") String apiKey,
            @Value("${app.llm.model:}") String model,
            @Value("${app.llm.max-tokens:9000}") int maxTokens,
            @Value("${app.llm.max-tokens-param:max_tokens}") String maxTokensParam,
            @Value("${app.llm.temperature:}") String temperature,
            @Value("${app.llm.timeout-seconds:180}") int timeoutSeconds) {
        this.provider = provider == null ? "none" : provider.trim().toLowerCase(Locale.ROOT);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        boolean anthropic = "anthropic".equals(this.provider);
        String defaultBase = anthropic ? "https://api.anthropic.com" : "https://api.openai.com/v1";
        this.baseUrl = stripTrailingSlash(baseUrl == null || baseUrl.isBlank() ? defaultBase : baseUrl.trim());
        this.model = model == null || model.isBlank() ? (anthropic ? "claude-sonnet-5" : "") : model.trim();
        this.maxTokens = Math.max(1000, maxTokens);
        this.maxTokensParam = maxTokensParam;
        this.temperature = parseDouble(temperature);
        this.timeoutSeconds = Math.max(30, timeoutSeconds);
    }

    public boolean configured() {
        return ("anthropic".equals(provider) || "openai".equals(provider)) && !apiKey.isEmpty() && !model.isEmpty();
    }

    public String provider() { return provider; }

    public String model() { return model; }

    /** Why generation is unavailable, for the admin UI ("" when configured). */
    public String setupHint() {
        if (configured()) return "";
        if (!"anthropic".equals(provider) && !"openai".equals(provider)) return "Set app.llm.provider to 'anthropic' or 'openai' (OpenAI-compatible: OpenAI, Groq, Gemini, OpenRouter, Ollama).";
        if (apiKey.isEmpty()) return "Set the LLM_API_KEY environment variable (app.llm.api-key).";
        return "Set LLM_MODEL (app.llm.model) - required for the 'openai' provider.";
    }

    public String complete(String system, String user) {
        if (!configured()) throw new LlmException("LLM is not configured. " + setupHint());
        try {
            HttpRequest request = "anthropic".equals(provider) ? anthropicRequest(system, user) : openAiRequest(system, user);
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new LlmException(describeHttpError(response.statusCode(), response.body()));
            return "anthropic".equals(provider) ? parseAnthropic(response.body()) : parseOpenAi(response.body());
        } catch (LlmException e) {
            throw e;
        } catch (java.net.http.HttpTimeoutException e) {
            throw new LlmException("The LLM did not answer within " + timeoutSeconds + "s. Try again or raise app.llm.timeout-seconds.", e);
        } catch (IOException e) {
            throw new LlmException("Could not reach the LLM endpoint (" + baseUrl + "): " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmException("LLM request was interrupted", e);
        }
    }

    // ---------------------------------------------------------------------------------------- wire formats

    private HttpRequest anthropicRequest(String system, String user) throws IOException {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        if (temperature != null) body.put("temperature", temperature);
        body.put("system", system);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "user").put("content", user);
        return HttpRequest.newBuilder(URI.create(baseUrl + "/v1/messages"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("content-type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
    }

    private HttpRequest openAiRequest(String system, String user) throws IOException {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put(maxTokensParam, maxTokens);
        if (temperature != null) body.put("temperature", temperature);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", system);
        messages.addObject().put("role", "user").put("content", user);
        return HttpRequest.newBuilder(URI.create(baseUrl + "/chat/completions"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("content-type", "application/json")
                .header("authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
    }

    private String parseAnthropic(String json) throws IOException {
        JsonNode root = mapper.readTree(json);
        StringBuilder sb = new StringBuilder();
        for (JsonNode block : root.path("content")) {
            if ("text".equals(block.path("type").asText())) sb.append(block.path("text").asText());
        }
        if ("max_tokens".equals(root.path("stop_reason").asText())) {
            throw new LlmException("The model's answer was cut off (max tokens reached). Increase app.llm.max-tokens or ask for a smaller question.");
        }
        if (sb.length() == 0) throw new LlmException("The LLM returned an empty answer.");
        return sb.toString();
    }

    private String parseOpenAi(String json) throws IOException {
        JsonNode choice = mapper.readTree(json).path("choices").path(0);
        String text = choice.path("message").path("content").asText("");
        if ("length".equals(choice.path("finish_reason").asText())) {
            throw new LlmException("The model's answer was cut off (max tokens reached). Increase app.llm.max-tokens or ask for a smaller question.");
        }
        if (text.isBlank()) throw new LlmException("The LLM returned an empty answer.");
        return text;
    }

    private String describeHttpError(int status, String body) {
        String detail = body == null ? "" : body.replaceAll("\\s+", " ").trim();
        if (detail.length() > 300) detail = detail.substring(0, 300) + "…";
        String hint = switch (status) {
            case 401, 403 -> " Check LLM_API_KEY and that the key may use this model.";
            case 404 -> " Check app.llm.base-url and app.llm.model.";
            case 429 -> " Rate limited - wait a moment and retry.";
            default -> "";
        };
        return "LLM request failed (HTTP " + status + ")." + hint + (detail.isEmpty() ? "" : " Provider said: " + detail);
    }

    private static String stripTrailingSlash(String s) { return s.endsWith("/") ? s.substring(0, s.length() - 1) : s; }

    private static Double parseDouble(String s) {
        try { return s == null || s.isBlank() ? null : Double.valueOf(s.trim()); } catch (NumberFormatException e) { return null; }
    }
}
