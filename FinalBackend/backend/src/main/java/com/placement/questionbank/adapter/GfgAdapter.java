package com.placement.questionbank.adapter;

import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.QuestionSource;
import org.springframework.stereotype.Component;

/**
 * GeeksforGeeks connector. Runs in METADATA_REFERENCE_ONLY mode against admin-curated metadata.
 * GFG does not publish a general-purpose public API for redistributing article/problem content;
 * if a licensing arrangement is ever established, implement the real client here.
 */
@Component
public class GfgAdapter extends MetadataSeedAdapter {

    public GfgAdapter(QuestionSourceProperties properties) {
        super(properties.getGfg());
    }

    @Override
    public QuestionSource getSource() {
        return QuestionSource.GFG;
    }

    @Override
    protected String defaultSeedClasspath() {
        return "questionbank-seed/gfg.json";
    }
}
