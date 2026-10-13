package com.placement.managedtest.controller;

import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.TestStatus;
import com.placement.managedtest.entity.TestType;
import com.placement.managedtest.service.ManagedTestAdminService;
import com.placement.managedtest.service.ManagedTestAnalyticsService;
import com.placement.managedtest.service.ManagedTestAttemptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin test management. Everything under /api/admin/** is already restricted to ADMIN and
 * PLACEMENT_ADMIN by the existing SecurityConfig rule, so no extra @PreAuthorize is needed - and
 * adding one here would create a second place to keep in sync.
 */
@RestController
@RequestMapping("/api/admin/tests")
@RequiredArgsConstructor
public class ManagedTestAdminController {

    private final ManagedTestAdminService adminService;
    private final ManagedTestAnalyticsService analyticsService;
    private final ManagedTestAttemptService attemptService;

    // ---- tests ----

    @GetMapping
    public Page<TestSummaryResponse> list(@RequestParam(required = false) TestStatus status,
                                          @RequestParam(required = false) TestType testType,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return adminService.list(status, testType, search, page, size);
    }

    @GetMapping("/{id}")
    public TestDetailResponse get(@PathVariable Long id) { return adminService.detail(id); }

    @PostMapping
    public TestDetailResponse create(@Valid @RequestBody TestUpsertRequest request) {
        return adminService.create(request);
    }

    @PutMapping("/{id}")
    public TestDetailResponse update(@PathVariable Long id, @Valid @RequestBody TestUpsertRequest request) {
        return adminService.update(id, request);
    }

    /** Archive, not hard delete - attempts and analytics keep referencing the test. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> archive(@PathVariable Long id) {
        adminService.archive(id);
        return ResponseEntity.ok(Map.of("message", "Test archived"));
    }

    @PostMapping("/{id}/publish")
    public TestDetailResponse publish(@PathVariable Long id) { return adminService.publish(id); }

    @PostMapping("/{id}/unpublish")
    public TestDetailResponse unpublish(@PathVariable Long id) { return adminService.unpublish(id); }

    @PostMapping("/{id}/duplicate")
    public TestDetailResponse duplicate(@PathVariable Long id, @RequestBody(required = false) DuplicateRequest request) {
        return adminService.duplicate(id, request == null ? null : request.newName());
    }

    @GetMapping("/{id}/preview")
    public TestDetailResponse preview(@PathVariable Long id) { return adminService.preview(id); }

    // ---- sections ----

    @GetMapping("/{id}/sections")
    public List<SectionResponse> sections(@PathVariable Long id) { return adminService.sections(id); }

    @PostMapping("/{id}/sections")
    public SectionResponse addSection(@PathVariable Long id, @Valid @RequestBody SectionUpsertRequest request) {
        return adminService.addSection(id, request);
    }

    @PutMapping("/{id}/sections/{sectionId}")
    public SectionResponse updateSection(@PathVariable Long id, @PathVariable Long sectionId,
                                         @Valid @RequestBody SectionUpsertRequest request) {
        return adminService.updateSection(id, sectionId, request);
    }

    @DeleteMapping("/{id}/sections/{sectionId}")
    public ResponseEntity<Map<String, String>> deleteSection(@PathVariable Long id, @PathVariable Long sectionId) {
        adminService.deleteSection(id, sectionId);
        return ResponseEntity.ok(Map.of("message", "Section removed"));
    }

    @PostMapping("/{id}/sections/reorder")
    public ResponseEntity<Map<String, String>> reorderSections(@PathVariable Long id,
                                                               @Valid @RequestBody SectionReorderRequest request) {
        adminService.reorderSections(id, request.sectionIdsInOrder());
        return ResponseEntity.ok(Map.of("message", "Sections reordered"));
    }

    // ---- questions ----

    @PostMapping("/{id}/sections/{sectionId}/questions")
    public List<QuestionResponse> addBankQuestions(@PathVariable Long id, @PathVariable Long sectionId,
                                                   @Valid @RequestBody AddBankQuestionsRequest request) {
        return adminService.addBankQuestions(id, sectionId, request);
    }

    @PostMapping("/{id}/sections/{sectionId}/custom-questions")
    public QuestionResponse addCustomQuestion(@PathVariable Long id, @PathVariable Long sectionId,
                                              @Valid @RequestBody CustomQuestionRequest request) {
        return adminService.addCustomQuestion(id, sectionId, request);
    }

    @PutMapping("/{id}/custom-questions/{questionId}")
    public QuestionResponse updateQuestion(@PathVariable Long id, @PathVariable Long questionId,
                                           @Valid @RequestBody CustomQuestionRequest request) {
        return adminService.updateQuestion(id, questionId, request);
    }

    @DeleteMapping("/{id}/questions/{questionId}")
    public ResponseEntity<Map<String, String>> removeQuestion(@PathVariable Long id, @PathVariable Long questionId) {
        adminService.removeQuestion(id, questionId);
        return ResponseEntity.ok(Map.of("message", "Question removed"));
    }

    @PostMapping("/{id}/sections/{sectionId}/questions/reorder")
    public ResponseEntity<Map<String, String>> reorderQuestions(@PathVariable Long id, @PathVariable Long sectionId,
                                                                @Valid @RequestBody QuestionReorderRequest request) {
        adminService.reorderQuestions(id, sectionId, request.questionIdsInOrder());
        return ResponseEntity.ok(Map.of("message", "Questions reordered"));
    }

    /** Resolves the section's auto-selection rules against the Question Bank and attaches the result. */
    @PostMapping("/{id}/sections/{sectionId}/auto-fill")
    public AutoFillResponse autoFill(@PathVariable Long id, @PathVariable Long sectionId,
                                     @Valid @RequestBody AutoFillRequest request) {
        return adminService.autoFill(id, sectionId, request);
    }

    // ---- assignment ----

    @GetMapping("/{id}/assignments")
    public Page<AssignmentResponse> assignments(@PathVariable Long id,
                                                @RequestParam(defaultValue = "false") boolean includeRevoked,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "50") int size) {
        return adminService.assignments(id, includeRevoked, page, size);
    }

    @PostMapping("/{id}/assign")
    public List<AssignmentResponse> assign(@PathVariable Long id, @Valid @RequestBody AssignRequest request) {
        return adminService.assign(id, request.studentIds(), request.reason());
    }

    /** reason is an optional query param (DELETE conventionally carries no body in this codebase -
     *  see every other DELETE endpoint added this session) - the admin UI can prompt for a short
     *  note when revoking and pass it along, or omit it. */
    @DeleteMapping("/{id}/assign/{studentId}")
    public UnassignResponse unassign(@PathVariable Long id, @PathVariable Long studentId,
                                      @RequestParam(required = false) String reason) {
        return adminService.unassign(id, studentId, reason);
    }

    // ---- attempts / results ----

    @GetMapping("/{id}/attempts")
    public Page<AttemptSummaryResponse> attempts(@PathVariable Long id,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return analyticsService.attemptsForTest(id, page, size);
    }
}