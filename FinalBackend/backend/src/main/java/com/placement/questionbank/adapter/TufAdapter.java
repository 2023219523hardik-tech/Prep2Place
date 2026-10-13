package com.placement.questionbank.adapter;

import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.QuestionSource;
import org.springframework.stereotype.Component;

/**
 * Take U Forward (Striver sheets) connector. TUF has no publicly documented official API as of
 * this build; runs in METADATA_REFERENCE_ONLY mode against admin-curated metadata pointing back
 * to the source sheets. See questionbank-seed/README.md before enabling in production.
 */
@Component
public class TufAdapter extends MetadataSeedAdapter {

    public TufAdapter(QuestionSourceProperties properties) {
        super(properties.getTuf());
    }

    @Override
    public QuestionSource getSource() {
        return QuestionSource.TUF;
    }

    @Override
    protected String defaultSeedClasspath() {
        return "questionbank-seed/tuf.json";
    }
}
