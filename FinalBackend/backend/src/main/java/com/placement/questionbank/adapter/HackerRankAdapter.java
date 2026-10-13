package com.placement.questionbank.adapter;

import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.QuestionSource;
import org.springframework.stereotype.Component;

/**
 * HackerRank connector. HackerRank exposes REST APIs for its enterprise "HackerRank for Work"
 * product (managing your own tests/candidates), not a public content API for redistributing its
 * challenge catalog. Runs in METADATA_REFERENCE_ONLY mode. If Prep2Place obtains a HackerRank for
 * Work account and wants to pull questions from your own private library via that API, implement
 * the real authenticated client here and switch integrationMode to OFFICIAL_API.
 */
@Component
public class HackerRankAdapter extends MetadataSeedAdapter {

    public HackerRankAdapter(QuestionSourceProperties properties) {
        super(properties.getHackerrank());
    }

    @Override
    public QuestionSource getSource() {
        return QuestionSource.HACKERRANK;
    }

    @Override
    protected String defaultSeedClasspath() {
        return "questionbank-seed/hackerrank.json";
    }
}
