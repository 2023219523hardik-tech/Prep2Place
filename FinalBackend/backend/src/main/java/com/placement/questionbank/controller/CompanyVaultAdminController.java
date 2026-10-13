package com.placement.questionbank.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.CompanySheetRow;
import com.placement.questionbank.dto.CompanyVaultSeedDtos.IndexEntry;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.service.CompanyVaultAdminService;
import com.placement.questionbank.service.CompanyVaultAdminService.CompanyAdminView;
import com.placement.questionbank.service.CompanyVaultAdminService.SeedResult;
import com.placement.questionbank.service.CompanyVaultSeedService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/company-vault", "/api/admin/questionbank/company-vault"})
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyRole('ADMIN', 'PLACEMENT_ADMIN')")
public class CompanyVaultAdminController {

    private final CompanyVaultAdminService adminService;
    private final CompanyVaultSeedService seedService;
    private final ObjectMapper objectMapper;

    @Data
    public static class CreateCompanyRequest {
        private String name;
        private String slug;
    }

    @GetMapping("/companies")
    public ResponseEntity<List<CompanyAdminView>> listCompanies() {
        return ResponseEntity.ok(adminService.listCompanies());
    }

    @PostMapping("/companies")
    public ResponseEntity<Company> createCompany(@RequestBody CreateCompanyRequest req) {
        Company company = adminService.createCompany(req.getName(), req.getSlug());
        return ResponseEntity.ok(company);
    }

    /**
     * Seed whole Company Vault directory from _index.json
     */
    @PostMapping("/seed-index")
    public ResponseEntity<SeedResult> seedIndex(@RequestBody JsonNode body) {
        List<IndexEntry> entries = new ArrayList<>();
        try {
            if (body.isArray()) {
                entries = objectMapper.convertValue(body, new TypeReference<List<IndexEntry>>() {});
            } else if (body.isObject()) {
                JsonNode listNode = body.has("entries") ? body.get("entries")
                        : body.has("companies") ? body.get("companies")
                        : body.has("data") ? body.get("data") : null;
                if (listNode != null && listNode.isArray()) {
                    entries = objectMapper.convertValue(listNode, new TypeReference<List<IndexEntry>>() {});
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse index entries: {}", e.getMessage());
        }
        return ResponseEntity.ok(adminService.seedIndex(entries));
    }

    /**
     * Seed questions for a company with flexible JSON payload
     */
    @PostMapping("/seed-company")
    public ResponseEntity<SeedResult> seedCompany(
            @RequestParam(required = false) String companySlug,
            @RequestParam(required = false) String companyName,
            @RequestBody JsonNode body) {

        String slug = companySlug;
        String name = companyName;
        List<CompanySheetRow> questions = new ArrayList<>();

        if (body.isObject()) {
            if (slug == null || slug.isBlank()) {
                if (body.has("companySlug")) slug = body.path("companySlug").asText();
                else if (body.has("slug")) slug = body.path("slug").asText();
                else if (body.has("company")) slug = body.path("company").asText();
            }
            if (name == null || name.isBlank()) {
                if (body.has("companyName")) name = body.path("companyName").asText();
                else if (body.has("name")) name = body.path("name").asText();
            }

            JsonNode qNode = body.has("questions") ? body.get("questions")
                    : body.has("problems") ? body.get("problems")
                    : body.has("data") ? body.get("data") : null;
            if (qNode != null && qNode.isArray()) {
                questions = objectMapper.convertValue(qNode, new TypeReference<List<CompanySheetRow>>() {});
            }
        } else if (body.isArray()) {
            questions = objectMapper.convertValue(body, new TypeReference<List<CompanySheetRow>>() {});
        }

        if (slug == null || slug.isBlank()) {
            if (name != null && !name.isBlank()) {
                slug = name.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
            } else if (!questions.isEmpty() && questions.get(0).getCompanies() != null && !questions.get(0).getCompanies().isEmpty()) {
                slug = questions.get(0).getCompanies().get(0).trim().toLowerCase();
            }
        }

        return ResponseEntity.ok(adminService.seedCompany(slug, name, questions));
    }

    /**
     * Create a new company first, then seed questions into it immediately
     */
    @PostMapping("/create-and-seed")
    public ResponseEntity<SeedResult> createAndSeed(@RequestBody JsonNode body) {
        String slug = null;
        String name = null;
        List<CompanySheetRow> questions = new ArrayList<>();

        if (body.isObject()) {
            slug = body.path("companySlug").asText(body.path("slug").asText(null));
            name = body.path("companyName").asText(body.path("name").asText(null));

            JsonNode qNode = body.has("questions") ? body.get("questions")
                    : body.has("problems") ? body.get("problems")
                    : body.has("data") ? body.get("data") : null;
            if (qNode != null && qNode.isArray()) {
                questions = objectMapper.convertValue(qNode, new TypeReference<List<CompanySheetRow>>() {});
            }
        }

        if (slug == null || slug.isBlank()) {
            if (name != null && !name.isBlank()) {
                slug = name.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
            } else {
                slug = "custom-company";
            }
        }
        if (name == null || name.isBlank()) {
            name = slug.substring(0, 1).toUpperCase() + slug.substring(1);
        }

        return ResponseEntity.ok(adminService.seedCompany(slug, name, questions));
    }

    /**
     * Run all classpath seed files
     */
    @PostMapping("/seed-all")
    public ResponseEntity<Map<String, Object>> seedAllClasspath() {
        var report = seedService.importAll();
        return ResponseEntity.ok(Map.of(
                "message", "Classpath seed completed",
                "companiesUpserted", report.getCompaniesUpserted(),
                "ranksCreated", report.getRanksCreated(),
                "ranksUpdated", report.getRanksUpdated(),
                "rowsSeen", report.getRowsSeen()
        ));
    }
}
