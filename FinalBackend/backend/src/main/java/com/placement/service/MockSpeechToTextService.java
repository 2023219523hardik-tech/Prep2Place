package com.placement.service;

import org.springframework.stereotype.Service;

/** STUB: no real ASR is performed. Replace with a real STT engine for production use. */
@Service
public class MockSpeechToTextService implements SpeechToTextService {
    @Override
    public String transcribe(byte[] audioBytes, String contentType) {
        if (audioBytes == null || audioBytes.length == 0) return "";
        return "[MOCK TRANSCRIPT - replace SpeechToTextService with a real STT engine] " +
                "Audio received (" + audioBytes.length + " bytes, " + contentType + ").";
    }
}
