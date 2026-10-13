package com.placement.questionbank.service;

import com.placement.entity.Difficulty;
import com.placement.entity.CodingProblem;
import com.placement.exception.ApiException;
import com.placement.questionbank.dto.QuestionBankDtos.CompanyDetail;
import com.placement.questionbank.dto.QuestionBankDtos.CompanyQuestionView;
import com.placement.questionbank.dto.QuestionBankDtos.CompanySummary;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.entity.CompanyQuestionRank;
import com.placement.questionbank.entity.QuestionAvailabilityState;
import com.placement.questionbank.entity.QuestionDomain;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.CompanyQuestionRankRepository;
import com.placement.questionbank.repository.CompanyRepository;
import com.placement.repository.CodingProblemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuestionBankQueryService {

    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final CompanyRepository companyRepository;
    private final CompanyQuestionRankRepository companyQuestionRankRepository;
    private final CompanySheetLoader companySheetLoader;
    private final CodingProblemRepository codingProblemRepository;

    public Page<CanonicalQuestion> search(QuestionDomain domain, Difficulty difficulty, String topic, String company, String language, String text, Pageable pageable) {
        return canonicalQuestionRepository.search(domain, difficulty, topic, company, language, text, pageable);
    }

    /**
     * Random selection with recent-attempt-avoidance: candidates the given user has attempted
     * recently are deprioritized (moved to the back of the shuffled pool) whenever enough unseen
     * questions exist to satisfy the requested count without them. Never returns duplicate
     * canonical questions in the same result set. Always domain-scoped so a coding assessment can
     * never draw an aptitude MCQ and vice versa.
     */
    public List<CanonicalQuestion> selectRandom(QuestionDomain domain, Difficulty difficulty, int count, Set<Long> recentlyAttemptedIds) {
        return selectRandom(domain, difficulty, count, recentlyAttemptedIds, null);
    }

    /** Section 5: topic-scoped variant so a profile can restrict itself to a subset of the domain
     *  (e.g. a Quant-only aptitude test) rather than always drawing from the whole domain. Empty
     *  or null topics behaves exactly like the unscoped overload above. */
    public List<CanonicalQuestion> selectRandom(QuestionDomain domain, Difficulty difficulty, int count,
                                                 Set<Long> recentlyAttemptedIds, List<String> topics) {
        List<CanonicalQuestion> pool;
        if (topics == null || topics.isEmpty()) {
            pool = new ArrayList<>(canonicalQuestionRepository.findAvailableCandidatePool(domain, difficulty));
        } else {
            List<String> topicsLower = topics.stream().map(String::toLowerCase).toList();
            pool = new ArrayList<>(canonicalQuestionRepository.findAvailableCandidatePoolByTopics(domain, difficulty, topicsLower));
        }
        Collections.shuffle(pool);

        List<CanonicalQuestion> unseen = pool.stream().filter(q -> !recentlyAttemptedIds.contains(q.getId())).toList();
        List<CanonicalQuestion> seen = pool.stream().filter(q -> recentlyAttemptedIds.contains(q.getId())).toList();

        List<CanonicalQuestion> ordered = new ArrayList<>(unseen);
        ordered.addAll(seen); // recently-seen questions only get used if we run out of unseen ones

        return ordered.stream().distinct().limit(count).toList();
    }

    public long countByState(QuestionAvailabilityState state) {
        return canonicalQuestionRepository.countByAvailabilityState(state);
    }

    // --- Section 5: Company Vault ---

    /** First N questions per company are free; the rest require User.premium. Picked as a plain
     *  constant (not admin-configurable) deliberately - this is an MVP access-control shape ahead
     *  of real billing, not a merchandising system worth a config UI yet. */
    private static final int FREE_QUESTIONS_PER_COMPANY = 15;

    /** Landing grid: every company with at least one available question, most questions first.
     *  Enriched with Company entity stats (totalDistinctAvailable/includedInSheet/capped) when
     *  CompanyVaultSeedService has a row for that slug; null for companies that only ever existed
     *  as a tag (see CompanySummary javadoc). */
    public List<CompanySummary> listCompanies() {
        Map<String, Company> companiesBySlug = new LinkedHashMap<>();
        for (Company c : companyRepository.findAll()) {
            if (c.getSlug() != null) {
                companiesBySlug.put(c.getSlug().toLowerCase(), c);
            }
        }
        Map<String, CompanySummary.CompanySummaryBuilder> map = new LinkedHashMap<>();
        for (var entry : companySheetLoader.getSheetIndex().entrySet()) {
            String slug = entry.getKey().toLowerCase();
            Company match = companiesBySlug.get(slug);
            int included = entry.getValue().getIncludedInSheet() == null
                    ? companySheetLoader.getAuthorizedRankedList(slug).size()
                    : entry.getValue().getIncludedInSheet();
            var b = CompanySummary.builder().name(slug).questionCount(included);
            if (match != null) {
                b.slug(match.getSlug()).totalDistinctAvailable(match.getTotalDistinctAvailable())
                        .includedInSheet(match.getIncludedInSheet()).capped(match.getCapped());
            }
            map.put(slug, b);
        }
        for (Company c : companiesBySlug.values()) {
            String slug = c.getSlug().toLowerCase();
            if (!map.containsKey(slug)) {
                long qCount = companyQuestionRankRepository.countByCompanyId(c.getId());
                int count = c.getIncludedInSheet() != null ? c.getIncludedInSheet() : (int) qCount;
                map.put(slug, CompanySummary.builder()
                        .name(c.getName() != null && !c.getName().isBlank() ? c.getName() : slug)
                        .slug(c.getSlug())
                        .questionCount(count)
                        .totalDistinctAvailable(c.getTotalDistinctAvailable())
                        .includedInSheet(c.getIncludedInSheet())
                        .capped(c.getCapped()));
            }
        }
        return map.values().stream()
                .map(CompanySummary.CompanySummaryBuilder::build)
                .sorted(Comparator.comparing(CompanySummary::getQuestionCount).reversed()
                        .thenComparing(s -> s.getName().toLowerCase()))
                .toList();
    }

    public CompanyDetail getCompanyDetail(String company) {
        String slug = company == null ? "" : company.trim().toLowerCase();
        if (companySheetLoader.findIndexEntry(slug).isPresent()
                || !companyQuestionRankRepository.findRankedByCompanySlug(slug).isEmpty()) {
            List<CompanyQuestionView> questions = getCompanyQuestions(slug, true);
            Map<String, Long> byDifficulty = questions.stream().collect(java.util.stream.Collectors.groupingBy(
                    question -> question.getDifficulty() == null ? "UNKNOWN" : question.getDifficulty().name(),
                    LinkedHashMap::new, java.util.stream.Collectors.counting()));
            return CompanyDetail.builder().name(slug).questionCount(questions.size()).byDifficulty(byDifficulty).build();
        }
        List<Object[]> rows = canonicalQuestionRepository.countByDifficultyForCompany(company);
        Map<String, Long> byDifficulty = new LinkedHashMap<>();
        long total = 0;
        for (Object[] row : rows) {
            Difficulty d = (Difficulty) row[0];
            long cnt = (Long) row[1];
            byDifficulty.put(d == null ? "UNKNOWN" : d.name(), cnt);
            total += cnt;
        }
        if (total == 0) {
            throw ApiException.notFound("No questions found for company '" + company + "'");
        }
        return CompanyDetail.builder().name(company).questionCount(total).byDifficulty(byDifficulty).build();
    }

    /** Section 5 acceptance: locked entries never carry sourceUrl/description regardless of what
     *  the frontend does with the response - the gate is what leaves the server. CompanyVault
     *  follow-up: when CompanyQuestionRank data exists for this company, ordering (and therefore
     *  which questions land in the free tier) now follows real per-company frequency/rank instead
     *  of an arbitrary difficulty/title sort - see findByCompanyOrdered's javadoc for what it did
     *  before this existed. Companies with no rank data yet fall back to that original ordering
     *  unchanged, so nothing regresses for them. */
    public List<CompanyQuestionView> getCompanyQuestions(String company, boolean premium) {
        String slug = company == null ? "" : company.trim().toLowerCase();
        boolean hasAuthorizedSheet = companySheetLoader.findIndexEntry(slug).isPresent();
        if (hasAuthorizedSheet) {
            List<CompanySheetLoader.AuthorizedSheetEntry> authorized =
                    companySheetLoader.getAuthorizedRankedList(slug);
            List<CompanyQuestionView> views = buildAuthorizedSheetView(authorized, premium);
            if (views.isEmpty()) {
                throw ApiException.notFound("No resolved authorized questions found for company '" + company + "'");
            }
            return views;
        }

        List<CompanyQuestionRank> ranked = companyQuestionRankRepository.findRankedByCompanySlug(company);
        if (!ranked.isEmpty()) {
            return buildRankedView(ranked, premium);
        }

        List<CanonicalQuestion> questions = canonicalQuestionRepository.findByCompanyOrdered(company);
        if (questions.isEmpty()) {
            throw ApiException.notFound("No questions found for company '" + company + "'");
        }
        List<CompanyQuestionView> out = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            CanonicalQuestion q = questions.get(i);
            boolean locked = !premium && i >= FREE_QUESTIONS_PER_COMPANY;
            String sourceUrl = null;
            if (!locked) {
                sourceUrl = q.getSourceMappings().stream().findFirst().map(m -> m.getSourceUrl()).orElse(null);
            }
            out.add(CompanyQuestionView.builder()
                    .id(q.getId()).title(q.getCanonicalTitle()).difficulty(q.getDifficulty())
                    .locked(locked).sourceUrl(sourceUrl)
                    .build());
        }
        return out;
    }

    /**
     * Sheet order is authoritative. Entries without a resolved CanonicalQuestion are deliberately
     * omitted rather than replaced with tag matches: substituting them would reintroduce the exact
     * company-vault data leak this whitelist prevents.
     */
    private List<CompanyQuestionView> buildAuthorizedSheetView(
            List<CompanySheetLoader.AuthorizedSheetEntry> authorized, boolean premium) {
        List<Long> ids = authorized.stream()
                .map(CompanySheetLoader.AuthorizedSheetEntry::canonicalQuestionId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, CanonicalQuestion> questionsById = new LinkedHashMap<>();
        canonicalQuestionRepository.findAllById(ids)
                .forEach(question -> questionsById.put(question.getId(), question));
        Map<String, CodingProblem> codingProblems = new LinkedHashMap<>();
        codingProblemRepository.findBySourceQuestionIdIn(authorized.stream()
                        .map(CompanySheetLoader.AuthorizedSheetEntry::sourceQuestionId)
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(problem -> codingProblems.put(problem.getSourceQuestionId(), problem));

        List<CompanyQuestionView> out = new ArrayList<>();
        for (CompanySheetLoader.AuthorizedSheetEntry entry : authorized) {
            CodingProblem codingProblem = codingProblems.get(entry.sourceQuestionId());
            if (codingProblem == null) {
                continue;
            }
            CanonicalQuestion question = questionsById.get(entry.canonicalQuestionId());
            if (question != null && (!question.isActive()
                    || question.getAvailabilityState() != QuestionAvailabilityState.AVAILABLE)) {
                continue;
            }
            boolean locked = !premium && out.size() >= FREE_QUESTIONS_PER_COMPANY;
            String sourceUrl = locked ? null : entry.sourceUrl();
            out.add(CompanyQuestionView.builder()
                    .id(question == null ? codingProblem.getId() : question.getId()).codingProblemId(codingProblem.getId())
                    .title(codingProblem.getTitle()).difficulty(codingProblem.getDifficulty())
                    .locked(locked).sourceUrl(sourceUrl)
                    .rank(entry.rank()).frequencyScore(entry.frequencyScore())
                    .build());
        }
        return out;
    }

    private List<CompanyQuestionView> buildRankedView(List<CompanyQuestionRank> ranked, boolean premium) {
        List<CompanyQuestionView> out = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            CompanyQuestionRank r = ranked.get(i);
            CanonicalQuestion q = r.getCanonicalQuestion();
            boolean locked = !premium && i >= FREE_QUESTIONS_PER_COMPANY;
            String sourceUrl = null;
            if (!locked) {
                sourceUrl = q.getSourceMappings().stream().findFirst().map(m -> m.getSourceUrl()).orElse(null);
            }
            out.add(CompanyQuestionView.builder()
                    .id(q.getId()).title(q.getCanonicalTitle()).difficulty(q.getDifficulty())
                    .locked(locked).sourceUrl(sourceUrl)
                    .rank(r.getRank()).frequencyScore(r.getFrequencyScore())
                    .build());
        }
        return out;
    }
}
