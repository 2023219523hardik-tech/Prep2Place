package com.placement.service;

public interface SpeechToTextService {
    String transcribe(byte[] audioBytes, String contentType);
}
