package com.placement.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "coding_problem")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodingProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 5000)
    private String statement;

    private String topic; // Arrays, Strings, DP, Graphs, ...

    @Enumerated(EnumType.STRING)
    private Difficulty difficulty;

    @Column(length = 1000)
    private String sampleInput;

    @Column(length = 1000)
    private String sampleOutput;

    // -------- new fields for production-grade metadata --------

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @OrderBy("ordinal ASC")
    @JsonIgnore
    private List<ProblemExample> examples = new ArrayList<>();

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @OrderBy("ordinal ASC")
    @JsonIgnore
    private List<ProblemConstraint> constraints = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> templates = new HashMap<>(); // languageId -> starter code

    @Builder.Default
    private Integer timeLimitMs = 1000;

    @Builder.Default
    private Integer memoryLimitMb = 256;

    @Builder.Default
    private Double acceptanceRate = 56.4;

    private String companyTags; // csv: Google, Meta, Amazon, ...

    private String methodName; // e.g. "twoSum" or "solve"

    /** Logical return type (e.g. "int[]", "listnode", "list<list<int>>", "boolean") - drives the
     *  actual return type shown in the generated Java/C++ boilerplate (Section 4). Previously
     *  there was no such field and the generator hardcoded "Object"/"null" for every problem
     *  regardless of what this actually was - this field plus the fixed generator in
     *  CodingService is what makes the per-question signature real instead of a stub. */
    private String returnType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<ParameterSpec> parameters = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ExecutionMode executionMode = ExecutionMode.METHOD;

    /** SQL mode: the DDL + seed INSERTs used to stand up the problem's tables. DataFrame mode: the
     *  input DataFrame's column/dtype documentation (or the snippet that builds it). Unused for
     *  METHOD/STDIN/SCRIPT/CONTEST. */
    @Column(columnDefinition = "text")
    private String schemaDdl;

    /** SQL/DataFrame modes: the admin-authored reference result the student's query/code is
     *  checked against (or reviewed against, if this module has no automated SQL/DataFrame runner
     *  yet - see docker/code-runner). Unused for METHOD/STDIN/SCRIPT/CONTEST. */
    @Column(columnDefinition = "text")
    private String expectedOutput;

    /** Links this gradable, admin-curated problem to its entry in the unified Question Intelligence
     *  bank (com.placement.questionbank.entity.CanonicalQuestion). Nullable: not every CodingProblem
     *  needs a canonical mapping, but every problem used in a Coding Mock Test does - the mock-test
     *  engine selects canonical question ids and needs this to find the real, gradable content. */
    private Long canonicalQuestionId;

    /** Stable natural key from the seed source (e.g. "two-sum" from leetcode-company-seed.json or
     *  company-wise sheets). Used for idempotent upserts by the seed loaders. Mirrors
     *  QuestionSourceMapping.sourceQuestionId so that a question can be resolved from a sheet file
     *  through to its gradable CodingProblem row. Null for hand-curated problems created via
     *  DataLoader or the admin API. Backed by the partial unique index
     *  uk_coding_problem_source_question_id in V4. */
    @Column(length = 255)
    private String sourceQuestionId;

    /** Soft-delete flag. coding_submission.problem_id is a non-nullable FK to this table with no
     *  ON DELETE clause, so hard-deleting a problem any student has submitted to fails as a raw
     *  DB constraint violation - archiving is the safe default (see CodingProblemAdminService).
     *  Also now the sole gate for student visibility: previously CodingService.listProblems()
     *  filtered on sourceQuestionId IS NOT NULL, which meant every hand-curated problem seeded by
     *  DataLoader (Two Sum, Reverse a Linked List, ...) was invisible to students, and any problem
     *  created through the admin CRUD below (which never sets sourceQuestionId) would have been
     *  too. That filter is replaced by this flag. */
    @Builder.Default
    private boolean active = true;

    @Column(columnDefinition = "text")
    private String category;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String executionConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String testCasesJson;

    private String starterQuery;

    @Column(columnDefinition = "text")
    private String explanation;

    @Column(columnDefinition = "text")
    private String sourceUrl;

    @Column(columnDefinition = "text[]")
    private String[] topics;

    @Column(columnDefinition = "text[]")
    private String[] subtopics;

    @Column(columnDefinition = "text[]")
    private String[] tags;

    @Column(columnDefinition = "text[]")
    private String[] companies;
}