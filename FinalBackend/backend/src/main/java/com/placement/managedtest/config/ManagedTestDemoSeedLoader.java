package com.placement.managedtest.config;

import com.placement.entity.Difficulty;
import com.placement.entity.Role;
import com.placement.entity.User;
import com.placement.managedtest.entity.*;
import com.placement.managedtest.repository.*;
import com.placement.managedtest.service.TestQuestionSourcingService;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import com.placement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Development seed data: three ready-to-use tests (a university test, a technical MCQ test and a
 * mixed custom test) wired to real Question Bank rows.
 *
 * Gated behind app.managed-test.seed-demo (default true) - turn it off in any environment where you
 * do not want sample tests appearing in the admin list. It runs after TechnicalMcqSeedLoader
 * (@Order) because it draws its questions from the bank that loader fills.
 *
 * Idempotent by test name. It deliberately does NOT seed attempts, results or violations: fabricated
 * attempt history would flow straight into readiness scores and dashboards, where it is
 * indistinguishable from real student performance. Generate that by attempting a seeded test instead.
 */
@Component
@RequiredArgsConstructor
@Order(40)
@Slf4j
public class ManagedTestDemoSeedLoader implements ApplicationRunner {

    private final ManagedTestRepository testRepository;
    private final ManagedTestSectionRepository sectionRepository;
    private final ManagedTestQuestionRepository questionRepository;
    private final ManagedTestAssignmentRepository assignmentRepository;
    private final TechnicalMcqQuestionRepository technicalMcqRepository;
    private final TestQuestionSourcingService sourcingService;
    private final UserRepository userRepository;

    @Value("${app.managed-test.seed-demo:true}")
    private boolean seedDemo;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedDemo) {
            log.info("Managed test demo seed disabled (app.managed-test.seed-demo=false)");
            return;
        }
        if (technicalMcqRepository.countByActiveTrue() == 0) {
            log.warn("Skipping managed test demo seed: the technical MCQ bank is empty");
            return;
        }

        User admin = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN)
                .findFirst().orElse(null);

        seedUniversityTest(admin);
        seedTechnicalTest(admin);
        seedMixedCustomTest(admin);
    }

    // ------------------------------------------------------------------ university test

    private void seedUniversityTest(User admin) {
        if (exists("Sharda University - CSE 2027 Placement Assessment")) return;

        ManagedTest test = testRepository.save(ManagedTest.builder()
                .name("Sharda University - CSE 2027 Placement Assessment")
                .testType(TestType.UNIVERSITY_TEST)
                .description("Campus placement readiness assessment for the 2027 CSE batch.")
                .instructions("""
                        This assessment has four sections. Each section is separately timed.
                        Once you submit a section you cannot return to it.
                        Do not switch tabs or leave fullscreen - such events are recorded.
                        """)
                .organizationName("Sharda University")
                .organizationCode("SU")
                .batch("2027")
                .branch("CSE")
                .graduationYear(2027)
                .difficulty(Difficulty.MEDIUM)
                .durationMinutes(100)
                .passingPercentage(60)
                .negativeMarkingEnabled(true)
                .defaultNegativeMarks(0.25)
                .overallTimerEnabled(true)
                .sectionTimersEnabled(true)
                .attemptLimit(1)
                .proctored(true)
                .fullscreenRequired(true)
                .violationCountThreshold(8)
                .startsAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .endsAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .status(TestStatus.PUBLISHED)
                .publishedAt(Instant.now())
                .createdBy(admin)
                .build());

        addMcqSection(test, "DSA", SectionType.DSA, 0, 30, 2.0,
                List.of(TechnicalCategory.DSA, TechnicalCategory.DATA_STRUCTURES, TechnicalCategory.ALGORITHMS), 8);
        addMcqSection(test, "SQL", SectionType.SQL, 1, 20, 2.0,
                List.of(TechnicalCategory.SQL, TechnicalCategory.DBMS), 6);
        addMcqSection(test, "Aptitude", SectionType.APTITUDE, 2, 20, 1.0,
                List.of(TechnicalCategory.QUANTITATIVE_APTITUDE, TechnicalCategory.LOGICAL_REASONING,
                        TechnicalCategory.VERBAL_ABILITY, TechnicalCategory.APTITUDE), 8);
        addMcqSection(test, "Technical MCQ", SectionType.TECHNICAL_MCQ, 3, 30, 1.5,
                List.of(TechnicalCategory.OOPS, TechnicalCategory.OPERATING_SYSTEMS,
                        TechnicalCategory.COMPUTER_NETWORKS, TechnicalCategory.JAVA), 10);

        finishTest(test);
        assignToMatchingStudents(test, admin);
    }

    // ------------------------------------------------------------------ technical MCQ test

    private void seedTechnicalTest(User admin) {
        if (exists("Core Technical Fundamentals - Screening Round")) return;

        ManagedTest test = testRepository.save(ManagedTest.builder()
                .name("Core Technical Fundamentals - Screening Round")
                .testType(TestType.TECHNICAL_MCQ_TEST)
                .description("OOPS, OS, CN and DBMS screening round.")
                .instructions("40 minutes, single section. Negative marking applies.")
                .difficulty(Difficulty.MEDIUM)
                .durationMinutes(40)
                .passingPercentage(50)
                .negativeMarkingEnabled(true)
                .defaultNegativeMarks(0.25)
                .attemptLimit(2)
                .status(TestStatus.PUBLISHED)
                .publishedAt(Instant.now())
                .createdBy(admin)
                .build());

        ManagedTestSection section = newSection(test, "Technical MCQ", SectionType.TECHNICAL_MCQ, 0, 40, 1.0);
        section.setSelectionStrategy(SelectionStrategy.FIXED);
        section.setSelectionRules(new LinkedHashMap<>(Map.of(
                "sourceType", "TECHNICAL_MCQ",
                "categories", Map.of("OOPS", 4, "OPERATING_SYSTEMS", 4, "COMPUTER_NETWORKS", 4, "DBMS", 4))));
        sectionRepository.save(section);

        attach(section, pick(List.of(TechnicalCategory.OOPS, TechnicalCategory.OPERATING_SYSTEMS,
                TechnicalCategory.COMPUTER_NETWORKS, TechnicalCategory.DBMS), 16));
        finishTest(test);
    }

    // ------------------------------------------------------------------ mixed custom test

    private void seedMixedCustomTest(User admin) {
        if (exists("Full Stack Mixed Assessment (MCQ + SQL + DataFrame + Coding)")) return;

        ManagedTest test = testRepository.save(ManagedTest.builder()
                .name("Full Stack Mixed Assessment (MCQ + SQL + DataFrame + Coding)")
                .testType(TestType.CUSTOM_TEST)
                .description("Demonstrates a single assessment mixing MCQ, SQL, DataFrame and coding questions.")
                .instructions("Four sections of different question types. The overall timer applies.")
                .difficulty(Difficulty.MEDIUM)
                .durationMinutes(120)
                .passingPercentage(55)
                .attemptLimit(1)
                .status(TestStatus.DRAFT)   // left as a draft so the builder has something to open
                .createdBy(admin)
                .build());

        ManagedTestSection mcq = newSection(test, "Technical MCQ", SectionType.TECHNICAL_MCQ, 0, 20, 1.0);
        sectionRepository.save(mcq);
        attach(mcq, pick(List.of(TechnicalCategory.SPRING_BOOT, TechnicalCategory.REST_API,
                TechnicalCategory.MICROSERVICES, TechnicalCategory.JAVA), 8));

        ManagedTestSection sql = newSection(test, "SQL", SectionType.SQL, 1, 30, 10.0);
        sectionRepository.save(sql);
        questionRepository.save(ManagedTestQuestion.builder()
                .section(sql).questionType(TestQuestionType.SQL).origin(QuestionOrigin.CUSTOM)
                .title("Top 3 highest-paid employees per department")
                .difficulty(Difficulty.MEDIUM).topic("SQL").subtopic("Window Functions")
                .marks(10).negativeMarks(0).estimatedTimeSeconds(900).displayOrder(0)
                .payload(new LinkedHashMap<>(Map.of(
                        "body", "Return the three highest-paid employees in each department. "
                                + "Output columns: department_name, employee_name, salary. Ties may appear in any order.",
                        "schemaDdl", """
                                CREATE TABLE department (id INT PRIMARY KEY, name VARCHAR(100));
                                CREATE TABLE employee (id INT PRIMARY KEY, name VARCHAR(100),
                                                       department_id INT, salary INT);
                                """,
                        "sampleData", """
                                INSERT INTO department VALUES (1,'Engineering'),(2,'Sales');
                                INSERT INTO employee VALUES
                                  (1,'Asha',1,120000),(2,'Ravi',1,110000),(3,'Neha',1,105000),
                                  (4,'Imran',1,100000),(5,'Divya',2,90000),(6,'Karan',2,85000);
                                """,
                        "expectedOutput", """
                                Engineering|Asha|120000
                                Engineering|Ravi|110000
                                Engineering|Neha|105000
                                Sales|Divya|90000
                                Sales|Karan|85000
                                """,
                        "evaluation", "EXACT_ROWS")))
                .build());

        ManagedTestSection df = newSection(test, "DataFrame", SectionType.DATAFRAME, 2, 25, 10.0);
        sectionRepository.save(df);
        questionRepository.save(ManagedTestQuestion.builder()
                .section(df).questionType(TestQuestionType.DATAFRAME).origin(QuestionOrigin.CUSTOM)
                .title("Monthly revenue by region")
                .difficulty(Difficulty.MEDIUM).topic("Pandas").subtopic("GroupBy")
                .marks(10).negativeMarks(0).estimatedTimeSeconds(900).displayOrder(0)
                .payload(new LinkedHashMap<>(Map.of(
                        "body", "Given a DataFrame `sales` with columns [date, region, amount], produce total "
                                + "revenue per region per calendar month, sorted by month then region. "
                                + "Print the result as region|month|total, one row per line.",
                        "datasetRef", "sales.csv (date,region,amount)",
                        "requirements", "pandas >= 2.0",
                        "expectedOutput", """
                                East|2026-01|15400
                                West|2026-01|12200
                                East|2026-02|16100
                                West|2026-02|13050
                                """,
                        "evaluation", "EXACT_ROWS")))
                .build());

        ManagedTestSection coding = newSection(test, "Coding", SectionType.CODING, 3, 45, 20.0);
        sectionRepository.save(coding);
        questionRepository.save(ManagedTestQuestion.builder()
                .section(coding).questionType(TestQuestionType.CODING).origin(QuestionOrigin.CUSTOM)
                .title("Longest substring without repeating characters")
                .difficulty(Difficulty.MEDIUM).topic("Strings").subtopic("Sliding Window")
                .marks(20).negativeMarks(0).estimatedTimeSeconds(2400).displayOrder(0)
                .payload(new LinkedHashMap<>(Map.of(
                        "body", "Given a string s, return the length of the longest substring that contains no repeated characters.",
                        "inputFormat", "A single line containing the string s.",
                        "outputFormat", "A single integer.",
                        "constraints", "0 <= s.length <= 10^5; s consists of printable ASCII characters.",
                        "examples", List.of(
                                Map.of("input", "abcabcbb", "output", "3", "explanation", "\"abc\" has length 3."),
                                Map.of("input", "bbbbb", "output", "1", "explanation", "\"b\" is the longest.")),
                        "testCases", List.of(
                                Map.of("input", "abcabcbb", "expectedOutput", "3", "hidden", false),
                                Map.of("input", "pwwkew", "expectedOutput", "3", "hidden", false),
                                Map.of("input", "", "expectedOutput", "0", "hidden", true),
                                Map.of("input", "dvdf", "expectedOutput", "3", "hidden", true)),
                        "languages", List.of("java", "python", "cpp"),
                        "starterCode", Map.of(
                                "java", "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // your code here\n    }\n}",
                                "python", "def length_of_longest_substring(s: str) -> int:\n    # your code here\n    pass"),
                        "functionSignature", "int lengthOfLongestSubstring(String s)")))
                .build());

        finishTest(test);
    }

    // ------------------------------------------------------------------ helpers

    private boolean exists(String name) {
        return testRepository.findAll().stream().anyMatch(t -> name.equalsIgnoreCase(t.getName()));
    }

    private ManagedTestSection newSection(ManagedTest test, String name, SectionType type,
                                          int order, int minutes, double marksPerQuestion) {
        ManagedTestSection section = ManagedTestSection.builder()
                .test(test).name(name).sectionType(type).displayOrder(order)
                .durationMinutes(minutes).marksPerQuestion(marksPerQuestion)
                .negativeMarks(marksPerQuestion * 0.25)
                .randomizeQuestions(true).randomizeOptions(false)
                .selectionStrategy(SelectionStrategy.MANUAL)
                .build();
        test.getSections().add(section);
        return section;
    }

    private void addMcqSection(ManagedTest test, String name, SectionType type, int order,
                               int minutes, double marks, List<TechnicalCategory> categories, int count) {
        ManagedTestSection section = newSection(test, name, type, order, minutes, marks);
        sectionRepository.save(section);
        attach(section, pick(categories, count));
    }

    private List<TechnicalMcqQuestion> pick(List<TechnicalCategory> categories, int count) {
        List<TechnicalMcqQuestion> pool = new ArrayList<>();
        for (TechnicalCategory category : categories) pool.addAll(technicalMcqRepository.findPool(category, null));
        Collections.shuffle(pool);
        return pool.stream().limit(count).toList();
    }

    private void attach(ManagedTestSection section, List<TechnicalMcqQuestion> questions) {
        int order = section.getQuestions().size();
        for (TechnicalMcqQuestion source : questions) {
            ManagedTestQuestion q = sourcingService.snapshotFromBank(
                    QuestionSourceType.TECHNICAL_MCQ, source.getId(), section, null, null);
            q.setDisplayOrder(order++);
            questionRepository.save(q);
            section.getQuestions().add(q);
        }
        section.setQuestionCount(section.getQuestions().size());
        sectionRepository.save(section);
    }

    private void finishTest(ManagedTest test) {
        double total = 0d;
        for (ManagedTestSection section : test.getSections()) total += section.attachedMarks();
        test.setTotalMarks(total);
        testRepository.save(test);
        log.info("Seeded managed test '{}' ({} sections, {} marks)", test.getName(), test.getSections().size(), total);
    }

    /** Assigns the university test to students whose profile matches its cohort. */
    private void assignToMatchingStudents(ManagedTest test, User admin) {
        userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .limit(25)
                .forEach(student -> {
                    if (assignmentRepository.existsByTestIdAndStudentIdAndActiveTrue(test.getId(), student.getId())) return;
                    assignmentRepository.save(ManagedTestAssignment.builder()
                            .test(test).student(student).assignedBy(admin).build());
                });
    }
}
