package com.placement.controller;

import com.placement.service.SpeechToTextService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/speech")
@RequiredArgsConstructor
public class SpeechController {

    private final SpeechToTextService speechToTextService;

    @PostMapping(value = "/transcribe", consumes = "multipart/form-data")
    public Map<String, String> transcribe(@RequestParam("file") MultipartFile file) throws IOException {
        return Map.of("transcript", speechToTextService.transcribe(file.getBytes(), file.getContentType()));
    }

    @PostMapping(value = "/transcribe/{sessionId}", consumes = "multipart/form-data")
    public Map<String, String> transcribeForSession(@PathVariable Long sessionId, @RequestParam("file") MultipartFile file) throws IOException {
        String transcript = speechToTextService.transcribe(file.getBytes(), file.getContentType());
        return Map.of("sessionId", sessionId.toString(), "transcript", transcript);
    }
}
