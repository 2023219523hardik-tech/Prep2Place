package com.placement.controller;

import com.placement.entity.ProctoringIncident;
import com.placement.repository.ProctoringIncidentRepository;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/proctoring/incidents")
@RequiredArgsConstructor
public class ProctoringIncidentController {

    private final ProctoringIncidentRepository repository;
    private final CurrentUserService currentUserService;

    public record IncidentCreateReq(String sessionId, String type, String details, Integer severity) {}

    @PostMapping
    public ResponseEntity<ProctoringIncident> createIncident(@RequestBody IncidentCreateReq req) {
        LocalDateTime dedupWindow = LocalDateTime.now().minusSeconds(5);
        Optional<ProctoringIncident> existing = repository.findFirstBySessionIdAndTypeAndTimestampAfter(
                req.sessionId(), req.type(), dedupWindow);

        if (existing.isPresent()) {
            return ResponseEntity.status(HttpStatus.OK).body(existing.get());
        }

        ProctoringIncident incident = ProctoringIncident.builder()
                .sessionId(req.sessionId())
                .userId(currentUserService.getCurrentUser().getId())
                .type(req.type())
                .details(req.details())
                .severity(req.severity() != null ? req.severity() : 1)
                .build();

        ProctoringIncident saved = repository.save(incident);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Page<ProctoringIncident> listAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return repository.findAllByOrderByTimestampDesc(pageable);
    }

    @GetMapping("/session/{sessionId}")
    public List<ProctoringIncident> getBySessionId(@PathVariable String sessionId) {
        return repository.findBySessionIdOrderByTimestampDesc(sessionId);
    }
}
