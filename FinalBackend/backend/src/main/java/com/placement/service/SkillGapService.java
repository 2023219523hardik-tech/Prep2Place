package com.placement.service;

import com.placement.dto.ReadinessDtos.CategoryGap;
import com.placement.dto.ReadinessDtos.MissingSkillAction;
import com.placement.dto.ReadinessDtos.SkillGapResponse;
import com.placement.entity.JobRole;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.repository.JobRoleRepository;
import com.placement.service.support.SkillCategorizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SkillGapService {

    private final StudentProfileService studentProfileService;
    private final JobRoleRepository jobRoleRepository;

    // Categories that map to real, existing practice content on this platform (Section 3:
    // "each missing skill links directly to a learning resource, a coding topic filter, or a
    // roadmap week"). Categories without a dedicated practice module fall back to the roadmap.
    private static final Set<String> CODING_PRACTICE_CATEGORIES = Set.of("DSA & Languages");

    @Transactional(readOnly = true)
    public SkillGapResponse analyze(User student, Long roleId) {
        StudentProfile profile = studentProfileService.getOrCreateProfile(student);

        JobRole role = roleId != null
                ? jobRoleRepository.findById(roleId).orElseThrow(() -> ApiException.notFound("Job role not found"))
                : profile.getTargetRole();

        if (role == null) {
            log.warn("No target role set, skipping skill gaps for userId={}", student.getId());
            return new SkillGapResponse("Not Set", List.of(), List.of(), 0.0,
                    java.util.Collections.emptyList(), java.util.Collections.emptyList(), true);
        }

        Set<String> required = role.getRequiredSkills() == null ? Set.of() :
                Arrays.stream(role.getRequiredSkills().split(",")).map(String::trim).map(String::toLowerCase)
                        .filter(s -> !s.isEmpty()).collect(Collectors.toCollection(LinkedHashSet::new));

        Set<String> owned = profile.getSkills().stream().map(s -> s.getName().trim().toLowerCase()).collect(Collectors.toSet());

        List<String> matched = required.stream().filter(owned::contains).toList();
        List<String> missing = required.stream().filter(r -> !owned.contains(r)).toList();
        double matchPct = required.isEmpty() ? 0 : Math.round((matched.size() * 1000.0) / required.size()) / 10.0;

        // Per-category breakdown (Section 3: "radar/bar chart per category instead of one flat
        // percentage") - grouped using the same categorizer the profile page uses for skill
        // chips, so a skill is always in the same bucket everywhere it's shown.
        Map<String, List<String>> matchedByCategory = new LinkedHashMap<>();
        Map<String, List<String>> missingByCategory = new LinkedHashMap<>();
        for (String skill : required) {
            String category = SkillCategorizer.categorize(skill);
            (owned.contains(skill) ? matchedByCategory : missingByCategory)
                    .computeIfAbsent(category, k -> new ArrayList<>()).add(skill);
        }
        Set<String> allCategories = new LinkedHashSet<>();
        allCategories.addAll(matchedByCategory.keySet());
        allCategories.addAll(missingByCategory.keySet());

        List<CategoryGap> categoryBreakdown = allCategories.stream().map(category -> {
            List<String> catMatched = matchedByCategory.getOrDefault(category, List.of());
            List<String> catMissing = missingByCategory.getOrDefault(category, List.of());
            int total = catMatched.size() + catMissing.size();
            double pct = total == 0 ? 0 : Math.round((catMatched.size() * 1000.0) / total) / 10.0;
            return new CategoryGap(category, catMatched, catMissing, pct);
        }).sorted(Comparator.comparingDouble(CategoryGap::matchPercentage)).toList();

        List<MissingSkillAction> actions = missing.stream().map(skill -> {
            String category = SkillCategorizer.categorize(skill);
            if (CODING_PRACTICE_CATEGORIES.contains(category)) {
                return new MissingSkillAction(skill, category, "Practice on Coding",
                        "/coding?q=" + java.net.URLEncoder.encode(skill, java.nio.charset.StandardCharsets.UTF_8));
            }
            // No dedicated practice module exists for frameworks/DB/tools skills - the roadmap
            // (Resources page) is the real, existing destination for those, not a fabricated link.
            return new MissingSkillAction(skill, category, "View in Your Roadmap", "/recommendations");
        }).toList();

        return new SkillGapResponse(role.getTitle(), matched, missing, matchPct, categoryBreakdown, actions);
    }
}
