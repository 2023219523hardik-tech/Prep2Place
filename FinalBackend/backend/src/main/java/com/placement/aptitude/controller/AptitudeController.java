package com.placement.controller;

import com.placement.dto.AptitudeDtos.*;
import com.placement.entity.AptitudeQuestion;
import com.placement.service.AptitudeService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/aptitude")
@RequiredArgsConstructor
public class AptitudeController {

    private final AptitudeService aptitudeService;
    private final CurrentUserService currentUserService;

    @GetMapping("/questions")
    public List<AptitudeQuestion> questions() { return aptitudeService.listActiveQuestions(); }

    @PostMapping("/attempts")
    public AptitudeAttemptResponse submit(@RequestBody SubmitAptitudeRequest request) {
        return aptitudeService.submitAttempt(currentUserService.getCurrentUser(), request);
    }

    @GetMapping("/attempts/{attemptId}")
    public AptitudeAttemptResponse attempt(@PathVariable Long attemptId) { return aptitudeService.getAttempt(attemptId); }

    @GetMapping("/history")
    public List<AptitudeAttemptResponse> history() { return aptitudeService.history(currentUserService.getCurrentUser().getId()); }

    @GetMapping("/progress")
    public Map<String, Double> progress() { return aptitudeService.progressByTopic(currentUserService.getCurrentUser().getId()); }
}