package com.placement.managedtest.controller;

import com.placement.entity.Difficulty;
import com.placement.managedtest.dto.ManagedTestDtos.BankFacetsResponse;
import com.placement.managedtest.dto.ManagedTestDtos.BankQuestionResponse;
import com.placement.managedtest.entity.QuestionSourceType;
import com.placement.managedtest.service.TestQuestionSourcingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

/**
 * The searchable Question Bank behind the test builder's picker. Read-only: this endpoint never
 * mutates bank questions, it only surfaces them for selection.
 */
@RestController
@RequestMapping("/api/admin/question-bank")
@RequiredArgsConstructor
public class ManagedTestQuestionBankController {

    private final TestQuestionSourcingService sourcingService;

    @GetMapping
    public Page<BankQuestionResponse> search(
            @RequestParam(defaultValue = "TECHNICAL_MCQ") QuestionSourceType sourceType,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String subtopic,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String search,
            /** When present, results are flagged with whether they're already in that test. */
            @RequestParam(required = false) Long forTestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return sourcingService.searchBank(sourceType, category, topic, subtopic, difficulty,
                company, tag, search, forTestId, page, size);
    }

    @GetMapping("/facets")
    public BankFacetsResponse facets() { return sourcingService.facets(); }
}
