package com.placement.questionbank.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Bound from `companyvault.*` in application.yml. Mirrors the shape of
 * {@link QuestionSourceProperties} deliberately - CompanyVault's importer is a second, independent
 * seeding step layered on top of the questionbank sync, not a rewrite of it.
 */
@Configuration
@ConfigurationProperties(prefix = "companyvault")
@Getter
@Setter
public class CompanyVaultProperties {

    /** Set false to skip the importer entirely (e.g. in a test slice that doesn't need it). */
    private boolean enabled = true;

    /** Classpath location (Spring resource-pattern, supports classpath*:) of the per-company sheet
     *  files + _index.json. Overridable so an admin-maintained dataset can replace the bundled one
     *  without a code change. */
    private String seedClasspath = "classpath*:companyvault-seed/*.json";

    /** Filesystem or classpath location of the root-level authorized company-sheets directory
     *  (companysheets/{companyname.json}). Resolved through Spring's Resource loader so both
     *  file:./ and classpath: prefixes work. Defaults to the project-root sheets dir used in dev. */
    private String sheetsPath = "file:../company-wise-question-sheets/";

    /** Filesystem or classpath location of the main merged seed JSON used to hydrate
     *  the CodingProblem main pool. Defaults to the DSA question set for local dev. */
    private String seedJsonPath = "file:../dsa-questions.json";
}
