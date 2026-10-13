package com.placement.questionbank.adapter.dto;

import com.placement.entity.Difficulty;
import com.placement.questionbank.entity.QuestionDomain;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.SourceIntegrationMode;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Provider-agnostic shape every {@link com.placement.questionbank.adapter.QuestionSourceAdapter}
 * returns. The normalization service turns a list of these into (or merges them into) a
 * {@link com.placement.questionbank.entity.CanonicalQuestion}.
 *
 * Fields are deliberately all-optional except title/url/source/sourceQuestionId - some sources
 * will legitimately only ever populate metadata fields (see {@link SourceIntegrationMode}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RawSourceQuestion {
    private QuestionSource source;
    private String sourceQuestionId;
    private String title;
    private String sourceUrl;
    private SourceIntegrationMode integrationMode;
    @Builder.Default private QuestionDomain domain = QuestionDomain.CODING; // TUF/LeetCode/HackerRank/GFG are all DSA sources today

    private String description;          // null unless integrationMode permits full content
    private Difficulty difficulty;
    @Builder.Default private List<String> topics = new ArrayList<>();
    @Builder.Default private List<String> subtopics = new ArrayList<>();
    @Builder.Default private List<String> companies = new ArrayList<>();
    @Builder.Default private List<String> tags = new ArrayList<>();
    @Builder.Default private List<String> supportedLanguages = new ArrayList<>();
    @Builder.Default private List<String> examples = new ArrayList<>();
    private String constraints;
    private String inputFormat;
    private String outputFormat;
    private String hints;                // only when permitted
    private String attribution;
}
