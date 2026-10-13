package com.placement.codinglab.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.runner.AssessmentContentValidator;
import com.placement.codinglab.service.CodingAssessmentAdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;

/**
 * Seeds the Coding Lab with six ready-made, realistic questions (Backend / Frontend / ML / AI / GenAI / RAG) from
 * {@code src/main/resources/codinglab-seed/*.json}. Each file is an {@link AssessmentBlueprint} - the same JSON the
 * admin "Import" and "Export" use - and each was proven sound by {@code CodingLabSeedSelfCheckTest}, which runs
 * the reference solution through the real runner scripts.
 *
 * <p>Runs only while the catalogue holds no current-model question, so it never resurrects seeds an admin removed
 * and never duplicates. Disable with {@code app.coding-lab.seed.enabled=false}.
 */
@Component
@Order(22)
@RequiredArgsConstructor
@Slf4j
public class CodingLabSeedLoader implements CommandLineRunner {

    private final CodingAssessmentAdminService adminService;

    @Value("${app.coding-lab.seed.enabled:true}")
    private boolean enabled;

    @Value("${app.coding-lab.seed.classpath:classpath*:codinglab-seed/*.json}")
    private String pattern;

    private final ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public void run(String... args) throws Exception {
        if (!enabled || adminService.hasCurrentQuestions()) return;
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources(pattern);
        Arrays.sort(resources, Comparator.comparing(r -> String.valueOf(r.getFilename())));
        int loaded = 0;
        for (Resource resource : resources) {
            try (InputStream in = resource.getInputStream()) {
                AssessmentBlueprint bp = mapper.readValue(in, AssessmentBlueprint.class);
                if (AssessmentContentValidator.hasErrors(AssessmentContentValidator.validate(bp))) {
                    log.warn("Skipping invalid Coding Lab seed {}", resource.getFilename());
                    continue;
                }
                adminService.registerShippedSeed(bp, String.valueOf(resource.getFilename()));
                loaded++;
            } catch (Exception e) {
                log.warn("Could not load Coding Lab seed {}: {}", resource.getFilename(), e.getMessage());
            }
        }
        log.info("Coding Lab: seeded {} question(s)", loaded);
    }
}
