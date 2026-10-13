package com.placement.assessment.config;

import com.placement.assessment.entity.AssessmentProfile;
import com.placement.assessment.entity.AssessmentType;
import com.placement.assessment.repository.AssessmentProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Seeds the mock-test catalog. Section 5 rewrite: the original version of this file seeded only
 * 6 generic coding tests, 2 company-style coding rounds, and a single aptitude test covering
 * every topic at once - "sparse content" was a real, accurate complaint. This version seeds a
 * much larger, filterable catalog by actually using the aptitude question bank's real topic
 * breadth (1800+ questions across 30+ topics - see AptitudeQuestionSeedLoader) instead of
 * lumping everything into one undifferentiated test, and by adding difficulty tiers and more
 * recruiter-style coding rounds.
 *
 * Every profile here is just data - the engine that generates a random question set from it
 * (AssessmentEngineService) is what makes any given profile produce a different randomized set on
 * every attempt rather than a fixed question list. Company profiles use plausible, clearly
 * generic structure and are NOT represented as an actual reproduction of any company's real
 * hiring process - see AssessmentProfile.companyName javadoc.
 */
@Component
@Order(20) // after the core DataLoader, before nothing in particular - no hard dependency either way
@RequiredArgsConstructor
public class AssessmentProfileSeedLoader implements CommandLineRunner {

    private final AssessmentProfileRepository repository;

    // Real topic strings as they appear in seed-data/aptitude-questions.json, grouped into the
    // four broad categories the Mock Tests page filters by. Kept here (not derived) because the
    // canonical-question topic filter (Section 3/5) matches on these exact strings.
    private static final List<String> QUANT_TOPICS = List.of(
            "Percentages", "Profit & Loss", "Averages", "Time-Speed-Distance", "Time & Work",
            "Simple & Compound Interest", "Number Systems", "LCM & HCF", "Algebra",
            "Geometry & Mensuration", "Permutation & Combination", "Probability", "Statistics");
    private static final List<String> LOGICAL_TOPICS = List.of(
            "Series (Number)", "Coding-Decoding", "Blood Relations", "Direction Sense",
            "Seating Arrangement (Linear)", "Seating Arrangement (Circular)", "Puzzles (Family Tree)",
            "Syllogisms", "Statement-Assumption", "Statement-Conclusion", "Ranking/Order",
            "Venn Diagrams", "Pattern Recognition", "Series (Alphabet)", "Analogies",
            "Critical Reasoning (Assertion-Reason)");
    private static final List<String> VERBAL_TOPICS = List.of(
            "Vocabulary (Synonyms)", "One-Word Substitution", "Reading Comprehension",
            "Sentence Completion", "Para Jumbles", "Vocabulary (Antonyms)", "Grammar (Error Spotting)");
    private static final List<String> DI_TOPICS = List.of("Data Interpretation");

    @Override
    public void run(String... args) {
        if (repository.count() > 0) return;

        seedCodingTests();
        seedAptitudeTests();
        seedInterviewProfile();
    }

    // ---------------------------------------------------------------------------------------
    // Coding mock tests
    // ---------------------------------------------------------------------------------------

    private void seedCodingTests() {
        // Difficulty-tiered generic tracks (previously all 6 used the identical distribution).
        repository.save(codingMockTest("Coding Mock Test 15 - Easy Track", Map.of("EASY", 2, "MEDIUM", 2), null));
        repository.save(codingMockTest("Coding Mock Test 16 - Easy Track", Map.of("EASY", 2, "MEDIUM", 2), null));
        repository.save(codingMockTest("Coding Mock Test 17 - Standard Track", Map.of("EASY", 1, "MEDIUM", 2, "HARD", 1), null));
        repository.save(codingMockTest("Coding Mock Test 18 - Standard Track", Map.of("EASY", 1, "MEDIUM", 2, "HARD", 1), null));
        repository.save(codingMockTest("Coding Mock Test 19 - Hard Track", Map.of("MEDIUM", 2, "HARD", 2), null));
        repository.save(codingMockTest("Coding Mock Test 20 - Hard Track", Map.of("MEDIUM", 2, "HARD", 2), null));

        // Company-style rounds (expanded from 2 to 8) - generic structure per recruiter archetype,
        // not a claim of official accuracy (see AssessmentProfile.companyName javadoc).
        repository.save(companyProfile("TCS NQT Style - Coding Round", "TCS", 60,
                Map.of("EASY", 1, "MEDIUM", 2), null));
        repository.save(companyProfile("Amazon SDE-1 Style - Coding Round", "Amazon", 90,
                Map.of("MEDIUM", 1, "HARD", 1), List.of("Arrays", "Trees", "Graphs")));
        repository.save(companyProfile("Google SWE Style - Coding Round", "Google", 60,
                Map.of("HARD", 2), List.of("Graphs", "DP")));
        repository.save(companyProfile("Microsoft SDE Style - Coding Round", "Microsoft", 60,
                Map.of("MEDIUM", 1, "HARD", 1), List.of("Trees", "Linked List", "Arrays")));
        repository.save(companyProfile("Flipkart SDE Style - Coding Round", "Flipkart", 60,
                Map.of("MEDIUM", 2), List.of("Arrays", "Strings")));
        repository.save(companyProfile("Infosys InfyTQ Style - Coding Round", "Infosys", 45,
                Map.of("EASY", 2, "MEDIUM", 1), null));
        repository.save(companyProfile("Wipro Elite NLTH Style - Coding Round", "Wipro", 45,
                Map.of("EASY", 1, "MEDIUM", 1), null));
        repository.save(companyProfile("Accenture ASE Style - Coding Round", "Accenture", 45,
                Map.of("EASY", 1, "MEDIUM", 1), null));
    }

    private AssessmentProfile codingMockTest(String name, Map<String, Integer> distribution, List<String> topicFocus) {
        int questionCount = distribution.values().stream().mapToInt(Integer::intValue).sum();
        var builder = AssessmentProfile.builder()
                .name(name)
                .assessmentType(AssessmentType.CODING_MOCK_TEST)
                .durationMinutes(90)
                .questionCount(questionCount)
                .difficultyDistribution(distribution)
                .allowedLanguages(List.of("java", "python", "cpp", "javascript"))
                .cameraRequired(true)
                .microphoneRequired(false)
                .screenShareRequired(true)
                .fullscreenRequired(true);
                // tabSwitchPolicy/allowCopy/allowPaste/terminateOnFirstFullscreenExit intentionally
                // left unset so this profile inherits AssessmentProfile's universal anti-cheat
                // defaults (Section 6: instant termination, no copy/paste) rather than overriding
                // them to something more lenient.
        if (topicFocus != null) builder.topicFocus(topicFocus);
        return builder.build();
    }

    private AssessmentProfile companyProfile(String name, String company, int durationMinutes,
                                              Map<String, Integer> distribution, List<String> topicFocus) {
        int questionCount = distribution.values().stream().mapToInt(Integer::intValue).sum();
        var builder = AssessmentProfile.builder()
                .name(name)
                .companyName(company)
                .assessmentType(AssessmentType.CODING_MOCK_TEST)
                .durationMinutes(durationMinutes)
                .questionCount(questionCount)
                .difficultyDistribution(distribution)
                .allowedLanguages(List.of("java", "python", "cpp"))
                .cameraRequired(true)
                .screenShareRequired(true)
                .fullscreenRequired(true)
                .allowCopy(false)
                .allowPaste(false)
                .tabSwitchPolicy(AssessmentProfile.TabSwitchPolicy.TERMINATE)
                .violationCountThreshold(3);
        if (topicFocus != null) builder.topicFocus(topicFocus);
        return builder.build();
    }

    // ---------------------------------------------------------------------------------------
    // Aptitude mock tests
    // ---------------------------------------------------------------------------------------

    private void seedAptitudeTests() {
        // Kept: the original all-topics test, for a candidate who wants a broad mixed round.
        repository.save(AssessmentProfile.builder()
                .name("Aptitude Mock Test - General")
                .assessmentType(AssessmentType.APTITUDE_MOCK_TEST)
                .durationMinutes(45)
                .questionCount(25)
                .difficultyDistribution(Map.of("EASY", 10, "MEDIUM", 10, "HARD", 5))
                .negativeMarkingEnabled(true)
                .negativeMarkingPenalty(0.25)
                .fullscreenRequired(true)
                .build());

        seedAptitudeCategory("Quantitative Aptitude", QUANT_TOPICS);
        seedAptitudeCategory("Logical Reasoning", LOGICAL_TOPICS);
        seedAptitudeCategory("Verbal Ability", VERBAL_TOPICS);

        // Data Interpretation only has ~54 seeded questions total (one topic, not a topic group),
        // so a single well-sized test rather than three difficulty tiers that would overlap heavily.
        repository.save(aptitudeProfile("Data Interpretation Practice Set", DI_TOPICS,
                20, Map.of("EASY", 6, "MEDIUM", 9, "HARD", 5), 35, null));

        repository.save(aptitudeProfile("TCS NQT Style - Aptitude Round", null,
                25, Map.of("EASY", 10, "MEDIUM", 10, "HARD", 5), 40, "TCS"));
        repository.save(aptitudeProfile("Infosys Style - Aptitude Round", null,
                20, Map.of("EASY", 8, "MEDIUM", 9, "HARD", 3), 35, "Infosys"));
    }

    private void seedAptitudeCategory(String categoryLabel, List<String> topics) {
        repository.save(aptitudeProfile(categoryLabel + " - Easy", topics, 20,
                Map.of("EASY", 14, "MEDIUM", 6), 30, null));
        repository.save(aptitudeProfile(categoryLabel + " - Medium", topics, 25,
                Map.of("EASY", 5, "MEDIUM", 15, "HARD", 5), 40, null));
        repository.save(aptitudeProfile(categoryLabel + " - Hard", topics, 20,
                Map.of("MEDIUM", 8, "HARD", 12), 35, null));
    }

    private AssessmentProfile aptitudeProfile(String name, List<String> topics, int questionCount,
                                               Map<String, Integer> distribution, int durationMinutes, String company) {
        var builder = AssessmentProfile.builder()
                .name(name)
                .assessmentType(AssessmentType.APTITUDE_MOCK_TEST)
                .durationMinutes(durationMinutes)
                .questionCount(questionCount)
                .difficultyDistribution(distribution)
                .negativeMarkingEnabled(true)
                .negativeMarkingPenalty(0.25)
                .fullscreenRequired(true);
        if (topics != null) builder.topicFocus(topics);
        if (company != null) builder.companyName(company);
        return builder.build();
    }

    // ---------------------------------------------------------------------------------------
    // AI interview profile (unchanged from the original seed - not part of Section 5's scope)
    // ---------------------------------------------------------------------------------------

    private void seedInterviewProfile() {
        repository.save(AssessmentProfile.builder()
                .name("AI Interview - General SDE Track")
                .assessmentType(AssessmentType.AI_INTERVIEW)
                .durationMinutes(40)
                .questionCount(12)
                .difficultyDistribution(Map.of("EASY", 4, "MEDIUM", 6, "HARD", 2))
                .topicFocus(List.of("Introduction", "Technical", "DSA", "Behavioral", "Situational"))
                .cameraRequired(true)
                .microphoneRequired(true)
                .fullscreenRequired(true)
                .build());
    }
}
