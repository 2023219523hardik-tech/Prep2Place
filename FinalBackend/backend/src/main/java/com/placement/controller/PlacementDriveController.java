package com.placement.controller;

import com.placement.entity.PlacementDrive;
import com.placement.repository.PlacementDriveRepository;
import com.placement.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
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

@RestController
@RequestMapping("/api/placement/drives")
@RequiredArgsConstructor
public class PlacementDriveController {

    private final PlacementDriveRepository placementDriveRepository;
    private final CurrentUserService currentUserService;

    public record DriveUpsertRequest(
            String title,
            String company,
            String description,
            LocalDateTime driveDate,
            String eligibility,
            Integer seatsAvailable,
            String location,
            String status
    ) {}

    @GetMapping
    public Object listAll(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null && size != null) {
            Pageable pageable = PageRequest.of(page, size);
            return placementDriveRepository.findAllByOrderByCreatedAtDesc(pageable);
        }
        return placementDriveRepository.findAllByOrderByCreatedAtDesc();
    }

    @GetMapping("/{id}")
    public PlacementDrive getById(@PathVariable Long id) {
        return placementDriveRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("PlacementDrive not found with id: " + id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PlacementDrive> create(@RequestBody DriveUpsertRequest request) {
        PlacementDrive drive = PlacementDrive.builder()
                .title(request.title())
                .company(request.company())
                .description(request.description())
                .driveDate(request.driveDate())
                .eligibility(request.eligibility())
                .seatsAvailable(request.seatsAvailable())
                .location(request.location())
                .status(request.status() != null ? request.status() : "ANNOUNCED")
                .build();
        PlacementDrive saved = placementDriveRepository.save(drive);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public PlacementDrive update(@PathVariable Long id, @RequestBody DriveUpsertRequest request) {
        PlacementDrive drive = placementDriveRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("PlacementDrive not found with id: " + id));
        if (request.title() != null) drive.setTitle(request.title());
        if (request.company() != null) drive.setCompany(request.company());
        if (request.description() != null) drive.setDescription(request.description());
        if (request.driveDate() != null) drive.setDriveDate(request.driveDate());
        if (request.eligibility() != null) drive.setEligibility(request.eligibility());
        if (request.seatsAvailable() != null) drive.setSeatsAvailable(request.seatsAvailable());
        if (request.location() != null) drive.setLocation(request.location());
        if (request.status() != null) drive.setStatus(request.status());
        return placementDriveRepository.save(drive);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        placementDriveRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
