package com.placement.codinglab.generation;

/** Any failure talking to the configured LLM. The message is safe to show to an administrator (never contains the API key). */
public class LlmException extends RuntimeException {
    public LlmException(String message) { super(message); }
    public LlmException(String message, Throwable cause) { super(message, cause); }
}
