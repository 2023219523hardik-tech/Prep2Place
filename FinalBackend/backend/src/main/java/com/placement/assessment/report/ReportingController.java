package com.placement.assessment.report;

import com.placement.assessment.report.ReportDtos.AttemptReport;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Candidate-facing evidence-based report for a single coding or aptitude mock test attempt. */
@RestController
@RequestMapping("/api/assessments/{attemptId}/report")
@RequiredArgsConstructor
public class ReportingController {

    private final ReportingService reportingService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public ResponseEntity<AttemptReport> report(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(reportingService.generateReport(candidate, attemptId));
    }
}
