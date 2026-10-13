package com.placement.questionbank.adapter;

import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.QuestionSource;
import org.springframework.stereotype.Component;

/**
 * LeetCode connector. LeetCode's problem statements are not available via a public/official API
 * for third-party redistribution; runs in METADATA_REFERENCE_ONLY mode. If LeetCode later offers
 * a licensed content partnership, implement the real client here and switch integrationMode to
 * LICENSED_DATASET or OFFICIAL_API in configuration.
 */
@Component
public class LeetCodeAdapter extends MetadataSeedAdapter {

    public LeetCodeAdapter(QuestionSourceProperties properties) {
        super(properties.getLeetcode());
    }

    @Override
    public QuestionSource getSource() {
        return QuestionSource.LEETCODE;
    }

    @Override
    protected String defaultSeedClasspath() {
        return "questionbank-seed/leetcode.json";
    }
}
