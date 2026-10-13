package com.placement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.dto.CodingDtos.CodeTestCase;
import com.placement.dto.CodingDtos.RunCodeResponse;
import com.placement.dto.CodingDtos.TestCaseResult;
import com.placement.entity.CodingProblem;
import com.placement.entity.ExecutionMode;
import com.placement.entity.ParameterSpec;
import com.placement.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class CodingRunnerService {

    private static final Set<String> SUPPORTED_PROVIDERS = Set.of("docker", "local");

    private final String provider;
    private final String dockerImage;
    private final boolean networkDisabled;
    private final int maxOutputBytes;
    private final int localJavaHeapMb;
    private final long localInfrastructureGraceMs;
    private final ObjectMapper objectMapper;

    public CodingRunnerService(
            @Value("${app.coding.runner.provider:docker}") String provider,
            @Value("${app.coding.runner.docker.image:prep2place-code-runner:latest}") String dockerImage,
            @Value("${app.coding.runner.docker.network-disabled:true}") boolean networkDisabled,
            @Value("${app.coding.runner.docker.max-output-bytes:65536}") int maxOutputBytes,
            @Value("${app.coding.runner.local.java-heap-mb:192}") int localJavaHeapMb,
            @Value("${app.coding.runner.local.infrastructure-grace-ms:10000}") long localInfrastructureGraceMs,
            ObjectMapper objectMapper) {

        this.provider = provider == null
                ? "docker"
                : provider.trim().toLowerCase();

        this.dockerImage = dockerImage;
        this.networkDisabled = networkDisabled;
        this.maxOutputBytes = Math.max(1024, maxOutputBytes);
        this.localJavaHeapMb = Math.max(32, localJavaHeapMb);
        this.localInfrastructureGraceMs = Math.max(5000, localInfrastructureGraceMs);
        this.objectMapper = objectMapper;
    }

    public RunCodeResponse run(
            CodingProblem problem,
            String language,
            String code,
            List<CodeTestCase> testCases,
            boolean includeHidden) {

        validateSource(code);

        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            return new RunCodeResponse(
                    "RUNNER_UNCONFIGURED",
                    List.of(),
                    "Unsupported coding runner provider: " + provider + ". Supported: " + SUPPORTED_PROVIDERS,
                    0,
                    testCases == null ? 0 : testCases.size(),
                    0,
                    0.0
            );
        }

        if (problem == null) {
            throw ApiException.badRequest("Coding problem is required");
        }

        if (language == null || language.isBlank()) {
            throw ApiException.badRequest("Language is required");
        }

        List<CodeTestCase> tests = testCases == null
                ? List.of()
                : testCases.stream()
                        .filter(Objects::nonNull)
                        .filter(t -> includeHidden || !Boolean.TRUE.equals(t.hidden()))
                        .toList();

        if (tests.isEmpty()) {
            return new RunCodeResponse(
                    "SUCCESS",
                    List.of(),
                    "No test cases supplied.",
                    0,
                    0,
                    0,
                    0.0
            );
        }

        long overallStart = System.nanoTime();

        // Every test case for this submission is executed in ONE sandbox invocation,
        // with the source compiled exactly once. The previous implementation looped
        // here and paid a full container start + recompilation per test case.
        List<TestCaseResult> results =
                executeBatch(
                        problem,
                        language,
                        code,
                        tests
                );

        long elapsedMs =
                TimeUnit.NANOSECONDS.toMillis(
                        System.nanoTime() - overallStart
                );

        int passed = (int) results.stream()
                .filter(r -> "PASSED".equals(r.status()))
                .count();

        String status = passed == results.size()
                ? "SUCCESS"
                : "FAILED";

        double memory = results.stream()
                .map(TestCaseResult::memoryMb)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .max()
                .orElse(0.0);

        String console = buildConsole(results);

        return new RunCodeResponse(
                status,
                results,
                console,
                passed,
                results.size(),
                (int) Math.min(Integer.MAX_VALUE, elapsedMs),
                memory
        );
    }

    /**
     * Executes ALL test cases for a submission using a single prepared (and, for
     * compiled languages, singly-compiled) program.
     *
     * Why this exists:
     * the previous implementation created a temp directory, generated the source with
     * the test input baked into it, started a fresh Docker container and re-ran the
     * compiler once PER TEST CASE. For N test cases that meant N container starts and
     * N compilations, which is what made a "Run" take seconds rather than milliseconds.
     *
     * Now the harness reads its input from stdin, so the program is prepared once and
     * only the (cheap) execution step repeats. Per-test time limits are still enforced
     * individually, so a single runaway test case cannot consume the whole budget.
     */
    private List<TestCaseResult> executeBatch(
            CodingProblem problem,
            String language,
            String code,
            List<CodeTestCase> tests) {

        Path tempDir = null;

        try {
            tempDir = Files.createTempDirectory("prep2place-run-");

            String normalizedLang =
                    language.trim().toLowerCase();

            // Prepared ONCE for the whole batch.
            PreparedProgram program =
                    prepareProgram(
                            problem,
                            normalizedLang,
                            code
                    );

            Files.writeString(
                    tempDir.resolve(program.fileName()),
                    program.source(),
                    StandardCharsets.UTF_8
            );

            // Each test case's input becomes a file the runner pipes in on stdin.
            for (int i = 0; i < tests.size(); i++) {
                Files.writeString(
                        tempDir.resolve(inputFileName(i)),
                        safe(tests.get(i).input()),
                        StandardCharsets.UTF_8
                );
            }

            int executionLimitMs =
                    problem.getTimeLimitMs() == null
                            ? 1000
                            : Math.max(100, problem.getTimeLimitMs());

            int memoryLimitMb =
                    problem.getMemoryLimitMb() == null
                            ? 256
                            : Math.max(64, problem.getMemoryLimitMb());

            return "docker".equals(provider)
                    ? executeBatchInDocker(
                            problem,
                            normalizedLang,
                            tempDir,
                            program,
                            tests,
                            executionLimitMs,
                            memoryLimitMb)
                    : executeBatchLocally(
                            problem,
                            normalizedLang,
                            tempDir,
                            program,
                            tests,
                            executionLimitMs,
                            memoryLimitMb);

        } catch (Exception e) {

            log.error(
                    "Coding batch execution failed: problemId={}, language={}",
                    problem.getId(),
                    language,
                    e
            );

            String message =
                    e.getMessage() == null
                            ? e.getClass().getSimpleName()
                            : e.getMessage();

            return allFailed(tests, message);

        } finally {
            deleteRecursively(tempDir);
        }
    }

    /**
     * Docker path: ONE container for the entire batch.
     *
     * The container compiles once and then loops over the test inputs, wrapping each
     * individual execution in GNU timeout so per-test limits still apply. Results are
     * framed with a per-run random marker so candidate output cannot forge a boundary.
     */
    private List<TestCaseResult> executeBatchInDocker(
            CodingProblem problem,
            String language,
            Path tempDir,
            PreparedProgram program,
            List<CodeTestCase> tests,
            int executionLimitMs,
            int memoryLimitMb) throws Exception {

        String marker =
                "P2P" + UUID.randomUUID().toString().replace("-", "");

        String script =
                buildBatchScript(
                        language,
                        program,
                        tests.size(),
                        executionLimitMs,
                        memoryLimitMb,
                        marker
                );

        // One container start + one compile for the batch, plus per-test execution.
        long graceMs =
                (long) executionLimitMs * tests.size()
                        + Math.max(15_000L, localInfrastructureGraceMs);

        ProcessResult result =
                executeInDocker(
                        problem,
                        language,
                        tempDir,
                        List.of("sh", "-c", script),
                        graceMs
                );

        return parseBatchOutput(
                tests,
                result,
                marker
        );
    }

    /**
     * Local path: no shell scripting and no container. Compile once directly, then run
     * the compiled artifact (or the script, for interpreted languages) once per test
     * case. Keeping the loop in Java rather than in a shell keeps this working
     * identically on Windows, where GNU timeout and sh are not available.
     */
    private List<TestCaseResult> executeBatchLocally(
            CodingProblem problem,
            String language,
            Path tempDir,
            PreparedProgram program,
            List<CodeTestCase> tests,
            int executionLimitMs,
            int memoryLimitMb) {

        String missingRuntime =
                checkRuntimeAvailable(language);

        if (missingRuntime != null) {
            return allFailed(
                    tests,
                    "Missing local runtime for '" + language + "': " + missingRuntime
                            + ". Ensure the compiler/interpreter is on your PATH and re-run, or switch provider to 'docker'."
            );
        }

        // ---- Compile ONCE (compiled languages only) ----
        List<String> compileCommand =
                buildLocalCompileCommand(language, program);

        if (compileCommand != null) {

            ProcessResult compile =
                    runProcess(
                            compileCommand,
                            tempDir,
                            null,
                            localInfrastructureGraceMs,
                            "coding-runner-compile"
                    );

            if (compile.exitCode() != 0) {

                String error = truncate(
                        compile.stderr() == null || compile.stderr().isBlank()
                                ? compile.stdout()
                                : compile.stderr()
                );

                return allFailed(
                        tests,
                        error.isBlank()
                                ? "Compilation failed with exit code " + compile.exitCode()
                                : error
                );
            }
        }

        // ---- Execute each test against the already-compiled artifact ----
        List<String> runCommand =
                buildLocalRunCommand(language, program, memoryLimitMb);

        List<TestCaseResult> results = new ArrayList<>();

        for (CodeTestCase test : tests) {

            long start = System.nanoTime();

            ProcessResult result =
                    runProcess(
                            runCommand,
                            tempDir,
                            safe(test.input()),
                            executionLimitMs + 2_000L,
                            "coding-runner-local"
                    );

            int runtimeMs =
                    (int) TimeUnit.NANOSECONDS.toMillis(
                            System.nanoTime() - start
                    );

            results.add(
                    toTestCaseResult(
                            test,
                            result.exitCode(),
                            result.stdout(),
                            result.stderr(),
                            result.timedOut(),
                            runtimeMs
                    )
            );
        }

        return results;
    }

    /**
     * Builds the in-container batch script: compile once, then run each test case
     * under its own timeout, emitting marker-delimited frames we can parse back.
     */
    private String buildBatchScript(
            String language,
            PreparedProgram program,
            int testCount,
            int executionLimitMs,
            int memoryLimitMb,
            String marker) {

        String compile =
                buildContainerCompileCommand(language, program);

        String run =
                buildContainerRunCommand(language, program, memoryLimitMb);

        String timeout =
                formatTimeout(executionLimitMs);

        StringBuilder sb = new StringBuilder();

        // A compile failure must abort before any test runs; the non-zero exit and
        // stderr are reported against every test case, matching previous behaviour.
        if (compile != null) {
            sb.append(compile).append(" || exit 97\n");
        }

        sb.append("i=0\n");
        sb.append("while [ $i -lt ").append(testCount).append(" ]; do\n");
        sb.append("  echo \"").append(marker).append("|CASE|$i\"\n");
        sb.append("  start=$(date +%s%N)\n");
        sb.append("  timeout --signal=TERM --kill-after=1s ")
                .append(timeout).append(" ")
                .append(run)
                .append(" < input_$i.txt 2> err_$i.txt\n");
        sb.append("  code=$?\n");
        sb.append("  end=$(date +%s%N)\n");
        // Guarantees the next marker begins on its own line even when the candidate's
        // output has no trailing newline.
        sb.append("  echo \"\"\n");
        sb.append("  echo \"").append(marker).append("|EXIT|$code\"\n");
        sb.append("  echo \"").append(marker).append("|TIME|$(( (end - start) / 1000000 ))\"\n");
        sb.append("  echo \"").append(marker).append("|ERR|\"\n");
        sb.append("  cat err_$i.txt\n");
        sb.append("  echo \"\"\n");
        sb.append("  echo \"").append(marker).append("|END|\"\n");
        sb.append("  i=$((i+1))\n");
        sb.append("done\n");

        return sb.toString();
    }

    /** Compile step for the container batch script, or null for interpreted languages. */
    private String buildContainerCompileCommand(
            String language,
            PreparedProgram program) {

        return switch (language) {
            case "java" -> "javac -encoding UTF-8 " + program.fileName();
            case "cpp", "c++" -> "g++ -std=c++17 -O2 -pipe " + program.fileName() + " -o /workspace/main";
            case "python", "javascript", "js" -> null;
            default -> throw ApiException.badRequest("Unsupported language: " + language);
        };
    }

    /**
     * Per-test execution step for the container batch script.
     *
     * The JVM flags matter here: with compilation hoisted out of the loop, JVM startup
     * becomes the dominant per-test cost, so we stop tiered compilation at C1 and use
     * the serial collector. Both meaningfully cut start-up time for short-lived runs.
     */
    private String buildContainerRunCommand(
            String language,
            PreparedProgram program,
            int memoryLimitMb) {

        int javaHeapMb =
                Math.max(32, Math.min(192, (int) Math.floor(memoryLimitMb * 0.70)));

        return switch (language) {
            case "java" -> "java -Xss256k -Xshare:auto -XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xms16m -Xmx"
                    + javaHeapMb + "m Main";
            case "python" -> "python3 " + program.fileName();
            case "javascript", "js" -> "node " + program.fileName();
            case "cpp", "c++" -> "/workspace/main";
            default -> throw ApiException.badRequest("Unsupported language: " + language);
        };
    }

    /** Local compile step, or null for interpreted languages. */
    private List<String> buildLocalCompileCommand(
            String language,
            PreparedProgram program) {

        boolean windows = isWindows();

        return switch (language) {
            case "java" -> List.of("javac", "-encoding", "UTF-8", program.fileName());
            case "cpp", "c++" -> List.of(
                    "g++", "-std=c++17", "-O2", "-pipe", program.fileName(),
                    "-o", windows ? "main.exe" : "main");
            case "python", "javascript", "js" -> null;
            default -> throw ApiException.badRequest("Unsupported language: " + language);
        };
    }

    /** Local per-test execution step, run against the already-compiled artifact. */
    private List<String> buildLocalRunCommand(
            String language,
            PreparedProgram program,
            int memoryLimitMb) {

        boolean windows = isWindows();

        int javaHeapMb =
                Math.max(32, Math.min(localJavaHeapMb, (int) Math.floor(memoryLimitMb * 0.70)));

        return switch (language) {
            case "java" -> List.of(
                    "java", "-Xss256k", "-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC",
                    "-Xms16m", "-Xmx" + javaHeapMb + "m", "Main");
            case "python" -> List.of(
                    binaryOnPath("python3") && !windows ? "python3" : "python",
                    program.fileName());
            case "javascript", "js" -> List.of("node", program.fileName());
            case "cpp", "c++" -> List.of(windows ? "main.exe" : "./main");
            default -> throw ApiException.badRequest("Unsupported language: " + language);
        };
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT)
                .contains("win");
    }

    private String inputFileName(int index) {
        return "input_" + index + ".txt";
    }

    /**
     * Parses the marker-delimited container output back into per-test results.
     *
     * Anything the batch could not report on (compile failure, or a hard infrastructure
     * timeout that cut the loop short) falls back to a failure carrying the batch-level
     * diagnostics, so no test is ever silently dropped.
     */
    private List<TestCaseResult> parseBatchOutput(
            List<CodeTestCase> tests,
            ProcessResult result,
            String marker) {

        if ("RUNNER_UNCONFIGURED".equals(result.status())) {
            return allFailed(
                    tests,
                    result.stderr() == null || result.stderr().isBlank()
                            ? "Runner is not configured."
                            : result.stderr()
            );
        }

        // Exit 97 is our sentinel for "compilation failed"; nothing ran.
        if (result.exitCode() == 97) {
            String error = truncate(result.stderr());
            return allFailed(
                    tests,
                    error.isBlank() ? "Compilation failed." : error
            );
        }

        Map<Integer, CaseFrame> frames =
                readFrames(result.stdout(), marker);

        List<TestCaseResult> results = new ArrayList<>();

        for (int i = 0; i < tests.size(); i++) {

            CodeTestCase test = tests.get(i);
            CaseFrame frame = frames.get(i);

            if (frame == null) {
                // The loop never reached this case - almost always the whole batch hit
                // the outer infrastructure timeout.
                results.add(
                        failed(
                                test,
                                "",
                                0,
                                0.0,
                                result.timedOut()
                                        ? "Execution timed out."
                                        : truncate(result.stderr()).isBlank()
                                                ? "Test case did not execute."
                                                : truncate(result.stderr())
                        )
                );
                continue;
            }

            results.add(
                    toTestCaseResult(
                            test,
                            frame.exitCode,
                            frame.stdout,
                            frame.stderr,
                            frame.exitCode == 124 || frame.exitCode == 137,
                            frame.runtimeMs
                    )
            );
        }

        return results;
    }

    /** Splits the batch stdout stream into per-test frames keyed by test index. */
    private Map<Integer, CaseFrame> readFrames(
            String batchStdout,
            String marker) {

        Map<Integer, CaseFrame> frames = new HashMap<>();

        if (batchStdout == null || batchStdout.isBlank()) {
            return frames;
        }

        String[] lines = batchStdout.split("\n", -1);

        Integer index = null;
        StringBuilder out = new StringBuilder();
        StringBuilder err = new StringBuilder();
        int exitCode = 0;
        int runtimeMs = 0;
        boolean inErr = false;

        for (String raw : lines) {

            String line = raw.endsWith("\r")
                    ? raw.substring(0, raw.length() - 1)
                    : raw;

            if (line.startsWith(marker + "|")) {

                String[] parts = line.split("\\|", 3);
                String kind = parts.length > 1 ? parts[1] : "";
                String value = parts.length > 2 ? parts[2] : "";

                switch (kind) {
                    case "CASE" -> {
                        index = parseIntSafe(value, -1);
                        out.setLength(0);
                        err.setLength(0);
                        exitCode = 0;
                        runtimeMs = 0;
                        inErr = false;
                    }
                    case "EXIT" -> exitCode = parseIntSafe(value, -1);
                    case "TIME" -> runtimeMs = parseIntSafe(value, 0);
                    case "ERR" -> inErr = true;
                    case "END" -> {
                        if (index != null && index >= 0) {
                            frames.put(
                                    index,
                                    new CaseFrame(
                                            out.toString(),
                                            err.toString(),
                                            exitCode,
                                            runtimeMs
                                    )
                            );
                        }
                        index = null;
                        inErr = false;
                    }
                    default -> { }
                }
                continue;
            }

            if (index == null) {
                continue;
            }

            if (inErr) {
                err.append(line).append("\n");
            } else {
                out.append(line).append("\n");
            }
        }

        return frames;
    }

    private int parseIntSafe(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    /**
     * Shared verdict logic for one test case, used by both the Docker batch parser and
     * the local executor so the two paths cannot drift apart.
     */
    private TestCaseResult toTestCaseResult(
            CodeTestCase test,
            int exitCode,
            String stdoutValue,
            String stderrValue,
            boolean timedOut,
            int runtimeMs) {

        if (timedOut) {
            return failed(test, safe(stdoutValue), runtimeMs, 0.0, "Execution timed out.");
        }

        if (exitCode != 0) {
            String error = truncate(stderrValue);
            return failed(
                    test,
                    safe(stdoutValue),
                    runtimeMs,
                    0.0,
                    error.isBlank()
                            ? "Program exited with code " + exitCode
                            : error
            );
        }

        String actual = normalize(stdoutValue);
        String expected = normalize(test.expectedOutput());

        if (expected.isBlank()) {
            return new TestCaseResult(
                    test.name(), "PASSED", safe(test.input()),
                    expected, actual, runtimeMs, 0.0, null, test.hidden()
            );
        }

        boolean passed = outputsEqual(actual, expected);

        return new TestCaseResult(
                test.name(),
                passed ? "PASSED" : "FAILED",
                safe(test.input()),
                expected,
                actual,
                runtimeMs,
                0.0,
                passed ? null : "Output does not match expected output.",
                test.hidden()
        );
    }

    private List<TestCaseResult> allFailed(
            List<CodeTestCase> tests,
            String error) {

        List<TestCaseResult> results = new ArrayList<>();

        for (CodeTestCase test : tests) {
            results.add(failed(test, "", 0, 0.0, error));
        }

        return results;
    }

    private record CaseFrame(
            String stdout,
            String stderr,
            int exitCode,
            int runtimeMs) {
    }

    private PreparedProgram prepareProgram(
            CodingProblem problem,
            String language,
            String candidateCode) {

        String normalized =
                language.trim().toLowerCase();

        ExecutionMode mode =
                problem.getExecutionMode() == null
                        ? ExecutionMode.METHOD
                        : problem.getExecutionMode();

        return switch (normalized) {

            case "java" ->
                    prepareJava(
                            problem,
                            candidateCode,
                            mode
                    );

            case "python" ->
                    preparePython(
                            problem,
                            candidateCode,
                            mode
                    );

            case "javascript", "js" ->
                    prepareJavaScript(
                            problem,
                            candidateCode,
                            mode
                    );

            case "cpp", "c++" ->
                    prepareCpp(
                            problem,
                            candidateCode,
                            mode
                    );

            default ->
                    throw ApiException.badRequest(
                            "Unsupported language: " + language
                    );
        };
    }

    private PreparedProgram prepareJava(
            CodingProblem problem,
            String code,
            ExecutionMode mode) {

        if (mode == ExecutionMode.STDIN
                || mode == ExecutionMode.SCRIPT
                || mode == ExecutionMode.CONTEST) {

            return new PreparedProgram(
                    "Main.java",
                    code
            );
        }

        String harness =
                JavaHarnessGenerator.generate(
                        problem,
                        code
                );

        return new PreparedProgram(
                "Main.java",
                harness
        );
    }

    private PreparedProgram preparePython(
            CodingProblem problem,
            String code,
            ExecutionMode mode) {

        if (mode == ExecutionMode.STDIN
                || mode == ExecutionMode.SCRIPT
                || mode == ExecutionMode.CONTEST) {

            return new PreparedProgram(
                    "main.py",
                    code
            );
        }

        String source =
                PythonHarnessGenerator.generate(
                        problem,
                        code
                );

        return new PreparedProgram(
                "main.py",
                source
        );
    }

    private PreparedProgram prepareJavaScript(
            CodingProblem problem,
            String code,
            ExecutionMode mode) {

        if (mode == ExecutionMode.STDIN
                || mode == ExecutionMode.SCRIPT
                || mode == ExecutionMode.CONTEST) {

            return new PreparedProgram(
                    "main.js",
                    code
            );
        }

        String source =
                JavaScriptHarnessGenerator.generate(
                        problem,
                        code
                );

        return new PreparedProgram(
                "main.js",
                source
        );
    }

    private PreparedProgram prepareCpp(
            CodingProblem problem,
            String code,
            ExecutionMode mode) {

        if (mode == ExecutionMode.STDIN
                || mode == ExecutionMode.SCRIPT
                || mode == ExecutionMode.CONTEST) {

            return new PreparedProgram(
                    "main.cpp",
                    code
            );
        }

        String source =
                CppHarnessGenerator.generate(
                        problem,
                        code
                );

        return new PreparedProgram(
                "main.cpp",
                source
        );
    }

    /**
     * Executes one test case inside an isolated Docker container.
     *
     * Important:
     * - Docker startup and compilation are NOT counted as candidate runtime.
     * - Candidate execution is controlled by GNU timeout inside the container.
     * - The host-side timeout contains enough grace for Docker startup/compilation.
     * - Container is forcibly removed when the host process times out.
     */
    private ProcessResult executeInDocker(
            CodingProblem problem,
            String language,
            Path tempDir,
            List<String> innerCommand,
            long infrastructureGraceMs) throws Exception {

        int memoryLimitMb =
                problem.getMemoryLimitMb() == null
                        ? 256
                        : Math.max(
                                64,
                                problem.getMemoryLimitMb()
                        );

        String containerName =
                "prep2place-run-" +
                        UUID.randomUUID()
                                .toString()
                                .replace("-", "");

        List<String> command = new ArrayList<>();

        command.add("docker");
        command.add("run");

        command.add("--name");
        command.add(containerName);

        command.add("--rm");

        /*
         * Read-only root filesystem.
         */
        command.add("--read-only");

        /*
         * Writable but non-executable /tmp.
         */
        command.add("--tmpfs");
        command.add(
                "/tmp:rw,noexec,nosuid,size=64m"
        );

        /*
         * CPU restriction.
         */
        command.add("--cpus=1");

        /*
         * Memory restriction.
         */
        command.add(
                "--memory=" +
                        memoryLimitMb +
                        "m"
        );

        /*
         * Prevent process bombs/fork bombs.
         */
        command.add("--pids-limit=64");

        /*
         * Drop Linux capabilities.
         */
        command.add("--cap-drop=ALL");

        /*
         * Prevent privilege escalation.
         */
        command.add(
                "--security-opt=no-new-privileges"
        );

        /*
         * Disable network access by default.
         */
        if (networkDisabled) {
            command.add("--network=none");
        }

        /*
         * Candidate workspace.
         */
        command.add("-v");
        command.add(
                tempDir.toAbsolutePath() +
                        ":/workspace:rw"
        );

        command.add("-w");
        command.add("/workspace");

        /*
         * Runner image.
         */
        command.add(dockerImage);

        /*
         * Actual execution command (a batch script covering every test case).
         */
        command.addAll(innerCommand);

        log.debug(
                "Executing coding sandbox batch: problemId={}, language={}, graceMs={}, memoryLimitMb={}, container={}",
                problem.getId(),
                language,
                infrastructureGraceMs,
                memoryLimitMb,
                containerName
        );

        Process process =
                new ProcessBuilder(command)
                        .redirectErrorStream(false)
                        .start();

        // Test inputs are supplied to each case from files inside the container,
        // so the container's own stdin is closed immediately.
        process.getOutputStream().close();

        StreamCollector stdout =
                new StreamCollector(
                        process.getInputStream(),
                        maxOutputBytes
                );

        StreamCollector stderr =
                new StreamCollector(
                        process.getErrorStream(),
                        maxOutputBytes
                );

        Thread stdoutThread =
                new Thread(
                        stdout,
                        "coding-runner-stdout"
                );

        Thread stderrThread =
                new Thread(
                        stderr,
                        "coding-runner-stderr"
                );

        stdoutThread.start();
        stderrThread.start();

        boolean completed =
                process.waitFor(
                        infrastructureGraceMs,
                        TimeUnit.MILLISECONDS
                );

        if (!completed) {

            log.warn(
                    "Coding runner exceeded infrastructure timeout. Killing container={}",
                    containerName
            );

            forceRemoveContainer(containerName);

            process.destroyForcibly();

            stdoutThread.join(1000);
            stderrThread.join(1000);

            return new ProcessResult(
                    -1,
                    stdout.value(),
                    stderr.value(),
                    true
            );
        }

        stdoutThread.join(2000);
        stderrThread.join(2000);

        int exitCode =
                process.exitValue();

        String stdoutValue =
                stdout.value();

        String stderrValue =
                stderr.value();

        /*
         * GNU timeout returns 124 when the command
         * reaches the configured timeout.
         *
         * 137 can occur when the process is killed after
         * the timeout grace period.
         */
        boolean candidateTimedOut =
                exitCode == 124
                        || exitCode == 137
                        || containsTimeoutMessage(stderrValue);

        return new ProcessResult(
                exitCode,
                stdoutValue,
                stderrValue,
                candidateTimedOut
        );
    }

    /**
     * Force-remove a potentially still-running Docker container.
     */
    private void forceRemoveContainer(
            String containerName) {

        try {

            Process cleanup =
                    new ProcessBuilder(
                            "docker",
                            "rm",
                            "-f",
                            containerName
                    )
                            .redirectErrorStream(true)
                            .start();

            cleanup.waitFor(
                    5,
                    TimeUnit.SECONDS
            );

        } catch (Exception e) {

            log.warn(
                    "Unable to remove Docker container {}",
                    containerName,
                    e
            );
        }
    }

    private boolean containsTimeoutMessage(
            String stderr) {

        if (stderr == null) {
            return false;
        }

        String value =
                stderr.toLowerCase(Locale.ROOT);

        return value.contains("timed out")
                || value.contains("timeout");
    }

    /**
     * Runs a single host process to completion with a hard wall-clock bound.
     *
     * This is the one place process plumbing lives for the local provider: it is used
     * both for the single compile step and for each subsequent test-case execution,
     * so the two cannot drift apart. Cross-platform by design - the timeout is enforced
     * by waitFor rather than GNU timeout, which Windows does not ship.
     */
    private ProcessResult runProcess(
            List<String> command,
            Path workDir,
            String stdinData,
            long timeoutMs,
            String threadLabel) {

        try {
            ProcessBuilder pb =
                    new ProcessBuilder(command)
                            .directory(workDir.toFile())
                            .redirectErrorStream(false);

            // Scrub sensitive application/cloud environment variables (JWT_SECRET, DB_PASSWORD, API keys)
            // so untrusted candidate code cannot read parent JVM secrets via System.getenv() / os.environ.
            Map<String, String> env = pb.environment();
            Set<String> allowedEnvKeys = Set.of(
                    "PATH", "JAVA_HOME", "LANG", "LC_ALL", "TZ", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT"
            );
            env.keySet().removeIf(k -> !allowedEnvKeys.contains(k.toUpperCase(Locale.ROOT)));
            env.put("HOME", workDir.toAbsolutePath().toString());
            env.put("TMPDIR", workDir.toAbsolutePath().toString());
            env.put("TMP", workDir.toAbsolutePath().toString());
            env.put("TEMP", workDir.toAbsolutePath().toString());
            env.put("PYTHONDONTWRITEBYTECODE", "1");

            Process process = pb.start();

            if (stdinData != null) {
                try (OutputStream output = process.getOutputStream()) {
                    output.write(stdinData.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                process.getOutputStream().close();
            }

            StreamCollector stdout =
                    new StreamCollector(
                            process.getInputStream(),
                            maxOutputBytes
                    );

            StreamCollector stderr =
                    new StreamCollector(
                            process.getErrorStream(),
                            maxOutputBytes
                    );

            Thread stdoutThread = new Thread(stdout, threadLabel + "-stdout");
            Thread stderrThread = new Thread(stderr, threadLabel + "-stderr");
            stdoutThread.start();
            stderrThread.start();

            boolean completed =
                    process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);

            if (!completed) {

                log.warn(
                        "Local coding runner exceeded timeout ({} ms). Killing process.",
                        timeoutMs
                );

                process.destroyForcibly();
                stdoutThread.join(1000);
                stderrThread.join(1000);

                return new ProcessResult(
                        -1,
                        stdout.value(),
                        stderr.value(),
                        true
                );
            }

            stdoutThread.join(2000);
            stderrThread.join(2000);

            int exitCode = process.exitValue();

            boolean timedOut =
                    exitCode == 124
                            || exitCode == 137
                            || containsTimeoutMessage(stderr.value());

            return new ProcessResult(
                    exitCode,
                    stdout.value(),
                    stderr.value(),
                    timedOut
            );

        } catch (Exception e) {

            log.error(
                    "Local process execution failed: command={}",
                    command.isEmpty() ? "<empty>" : command.get(0),
                    e
            );

            return new ProcessResult(
                    -1,
                    "",
                    e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(),
                    false
            );
        }
    }

    /**
     * Returns a descriptive error string if the required runtime binary cannot be found on PATH,
     * or null if everything needed is available. Because Java and C++ require two binaries each
     * (compiler + runtime), both are checked. We intentionally don't probe versions - a bare
     * "not found" is enough, and the ProcessBuilder downstream will surface real error messages.
     */
    private String checkRuntimeAvailable(String language) {
        return switch (language) {
            case "java" ->
                    binaryOnPath("javac") ? null
                            : binaryOnPath("java")
                            ? "javac compiler not found"
                            : "javac and java not found on PATH";
            case "python" ->
                    binaryOnPath("python3") || binaryOnPath("python")
                            ? null
                            : "python3/python not found on PATH";
            case "javascript", "js" ->
                    binaryOnPath("node") ? null : "node not found on PATH";
            case "cpp", "c++" ->
                    binaryOnPath("g++") ? null : "g++ not found on PATH";
            default -> "unsupported language";
        };
    }

    /**
     * Best-effort probe: runs `cmd --version` / `cmd -version` silently and returns true if the
     * process exits 0 within 3 seconds. Does NOT actually consume stdout; the point is to fail
     * fast with RUNNER_UNCONFIGURED before attempting to compile/execute real user code.
     */
    private boolean binaryOnPath(String command) {
        try {
            ProcessBuilder pb;
            String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
            if (os.contains("win")) {
                // Windows `where` is the canonical PATH search; `cmd --version` is not reliable.
                pb = new ProcessBuilder("where", command);
            } else {
                pb = new ProcessBuilder("which", command);
            }
            pb.redirectErrorStream(true);
            Process p = pb.start();
            p.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            return p.waitFor(3, TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Converts milliseconds to a GNU timeout duration.
     *
     * Example:
     * 1000 -> 1.000s
     * 1500 -> 1.500s
     */
    private String formatTimeout(
            int milliseconds) {

        return String.format(
                Locale.ROOT,
                "%.3fs",
                milliseconds / 1000.0
        );
    }

    private TestCaseResult failed(
            CodeTestCase test,
            String actual,
            int runtimeMs,
            double memory,
            String error) {

        return new TestCaseResult(
                test.name(),
                "FAILED",
                safe(test.input()),
                safe(test.expectedOutput()),
                safe(actual),
                runtimeMs,
                memory,
                truncate(error),
                test.hidden()
        );
    }

    /** Builds the human-readable console text sent back to the student in SubmitCodeResponse.
     *  Hidden test cases (result.hidden() == true) are deliberately reduced to a bare pass/fail
     *  line - no name, no runtime, no error/diff text - because this string is the one field on
     *  SubmitCodeResponse that touches per-test detail at all, and result.error() for a hidden
     *  case could otherwise contain runtime stderr or a diff message derived from hidden expected
     *  output. Visible-test lines are unchanged. */
    private String buildConsole(
            List<TestCaseResult> results) {

        StringBuilder sb =
                new StringBuilder();

        sb.append(
                "Prep2Place isolated Docker runner\n"
        );

        sb.append(
                "--------------------------------\n"
        );

        for (TestCaseResult result : results) {

            if (Boolean.TRUE.equals(result.hidden())) {
                sb.append("Hidden test: ")
                        .append(result.status())
                        .append("\n");
                continue;
            }

            sb.append(result.name())
                    .append(": ")
                    .append(result.status())
                    .append(" (")
                    .append(result.runtimeMs())
                    .append(" ms)");

            if (result.error() != null
                    && !result.error().isBlank()) {

                sb.append("\n")
                        .append(result.error());
            }

            sb.append("\n");
        }

        return sb.toString();
    }

    private boolean outputsEqual(
            String actual,
            String expected) {

        if (actual.equals(expected)) {
            return true;
        }

        String a =
                actual
                        .replaceAll("\\s+", "")
                        .replace("\"", "");

        String e =
                expected
                        .replaceAll("\\s+", "")
                        .replace("\"", "");

        return a.equals(e);
    }

    private String normalize(
            String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .trim();
    }

    private String truncate(
            String value) {

        if (value == null) {
            return "";
        }

        if (value.length() <= maxOutputBytes) {
            return value;
        }

        return value.substring(
                        0,
                        maxOutputBytes
                )
                + "\n[output truncated]";
    }

    private void validateSource(
            String code) {

        if (code == null || code.isBlank()) {
            throw ApiException.badRequest(
                    "Code cannot be empty"
            );
        }

        if (code.length() > 200_000) {
            throw ApiException.badRequest(
                    "Code exceeds maximum allowed size"
            );
        }
    }

    private String safe(
            String value) {

        return value == null
                ? ""
                : value;
    }

    private void deleteRecursively(
            Path path) {

        if (path == null
                || !Files.exists(path)) {

            return;
        }

        try {

            Files.walk(path)
                    .sorted(
                            Comparator.reverseOrder()
                    )
                    .forEach(p -> {

                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                        }

                    });

        } catch (IOException ignored) {
        }
    }

    private record PreparedProgram(
            String fileName,
            String source) {
    }

    /**
     * @param status Optional marker. When non-null, only "RUNNER_UNCONFIGURED" has special
     *     handling in the batch executors (skips exit-code-based comparisons and produces a FAILED test
     *     with a language-diagnostic error message instead). Null for all normal executions.
     */
    private record ProcessResult(
            int exitCode,
            String stdout,
            String stderr,
            boolean timedOut,
            String status) {

        ProcessResult(int exitCode, String stdout, String stderr, boolean timedOut) {
            this(exitCode, stdout, stderr, timedOut, null);
        }
    }

    private static final class StreamCollector
            implements Runnable {

        private final InputStream input;
        private final int maxBytes;

        private final StringBuilder builder =
                new StringBuilder();

        private StreamCollector(
                InputStream input,
                int maxBytes) {

            this.input = input;
            this.maxBytes = maxBytes;
        }

        @Override
        public void run() {

            try (InputStream in = input) {

                byte[] buffer =
                        new byte[4096];

                int read;
                int total = 0;

                while ((read = in.read(buffer)) != -1) {

                    int allowed =
                            Math.min(
                                    read,
                                    maxBytes - total
                            );

                    if (allowed > 0) {

                        builder.append(
                                new String(
                                        buffer,
                                        0,
                                        allowed,
                                        StandardCharsets.UTF_8
                                )
                        );
                    }

                    total += read;

                    if (total >= maxBytes) {
                        break;
                    }
                }

            } catch (IOException ignored) {
            }
        }

        String value() {
            return builder.toString();
        }
    }

    /*
     * ---------------------------------------------------------
     * Java method harness
     * ---------------------------------------------------------
     */
    private static final class JavaHarnessGenerator {

        private static final java.util.regex.Pattern JAVA_METHOD_HEADER_PATTERN = java.util.regex.Pattern.compile(
                "(?:public|protected|private)?\\s*(?:static)?\\s*([\\w<>\\[\\],\\s]+?)\\s+([a-zA-Z_]\\w*)\\s*\\(([^)]*)\\)"
        );

        private static MethodSignature inferMethodSignature(String candidate, CodingProblem problem, String defaultMethod) {
            MethodSignature sig = parseMethodSignature(candidate);
            if (sig != null && !sig.parameters.isEmpty()) {
                return sig;
            }
            if (problem != null && problem.getTemplates() != null) {
                String javaTemplate = problem.getTemplates().get("java");
                if (javaTemplate != null && !javaTemplate.isBlank()) {
                    MethodSignature templateSig = parseMethodSignature(javaTemplate);
                    if (templateSig != null && !templateSig.parameters.isEmpty()) {
                        return templateSig;
                    }
                    if (sig == null) sig = templateSig;
                }
            }
            return sig;
        }

        private static MethodSignature parseMethodSignature(String source) {
            if (source == null || source.isBlank()) return null;
            java.util.regex.Matcher matcher = JAVA_METHOD_HEADER_PATTERN.matcher(source);
            while (matcher.find()) {
                String ret = matcher.group(1).trim();
                String name = matcher.group(2).trim();
                String rawParams = matcher.group(3).trim();

                if ("Solution".equals(name) || "Main".equals(name) || "main".equals(name) || "class".equals(ret)) {
                    continue;
                }

                List<ParameterSpec> params = parseParameters(rawParams);
                return new MethodSignature(name, ret, params);
            }
            return null;
        }

        private static List<ParameterSpec> parseParameters(String rawParams) {
            List<ParameterSpec> list = new ArrayList<>();
            if (rawParams == null || rawParams.isBlank()) return list;

            List<String> parts = splitTopLevelCommas(rawParams);
            for (String part : parts) {
                String p = part.trim();
                if (p.isEmpty()) continue;
                int lastSpace = p.lastIndexOf(' ');
                if (lastSpace > 0) {
                    String type = p.substring(0, lastSpace).trim();
                    String name = p.substring(lastSpace + 1).trim();
                    list.add(new ParameterSpec(name, type, name));
                }
            }
            return list;
        }

        private static List<String> splitTopLevelCommas(String raw) {
            List<String> out = new ArrayList<>();
            if (raw == null || raw.isBlank()) return out;
            int depth = 0;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < raw.length(); i++) {
                char c = raw.charAt(i);
                if (c == '<' || c == '[' || c == '(') depth++;
                else if (c == '>' || c == ']' || c == ')') depth--;
                else if (c == ',' && depth == 0) {
                    out.add(sb.toString().trim());
                    sb.setLength(0);
                    continue;
                }
                sb.append(c);
            }
            if (sb.length() > 0) {
                out.add(sb.toString().trim());
            }
            return out;
        }

        private static final class MethodSignature {
            final String methodName;
            final String returnType;
            final List<ParameterSpec> parameters;

            MethodSignature(String methodName, String returnType, List<ParameterSpec> parameters) {
                this.methodName = methodName;
                this.returnType = returnType;
                this.parameters = parameters;
            }
        }

        static String generate(
                CodingProblem problem,
                String candidate) {

            String method = problem != null ? problem.getMethodName() : null;
            List<ParameterSpec> params = problem != null ? problem.getParameters() : null;

            if (params == null || params.isEmpty() || method == null || method.isBlank() || "solve".equalsIgnoreCase(method)) {
                MethodSignature sig = inferMethodSignature(candidate, problem, method);
                if (sig != null) {
                    if (method == null || method.isBlank() || "solve".equalsIgnoreCase(method)) {
                        method = sig.methodName;
                    }
                    if (params == null || params.isEmpty()) {
                        params = sig.parameters;
                    }
                }
            }

            if (method == null || method.isBlank()) {
                method = "solve";
            }
            if (params == null) {
                params = List.of();
            }

            StringBuilder source =
                    new StringBuilder();

            source.append("""
                    import java.util.*;
                    import java.io.*;
                    import java.lang.reflect.*;

                    public class Main {

                    """);

            // The structural helpers deliberately live inside Main before Solution.  That makes
            // them visible to the candidate while avoiding a second top-level public class.
            source.append(nodeDefinitions());
            source.append(extractCandidateClass(candidate));

            source.append("\n");

            source.append("""
                    public static void main(String[] args) throws Exception {
                    """);

            // Input arrives on stdin rather than being compiled into the source.
            // This is what allows a submission to be compiled ONCE and then executed
            // once per test case, instead of recompiling for every single test case.
            source.append(
                    "String input = new String(System.in.readAllBytes(), "
                            + "java.nio.charset.StandardCharsets.UTF_8).trim();\n");

            source.append(
                    "Solution solution = new Solution();\n"
            );

            source.append(
                    "Object[] values = InputParser.arguments(input, new String[]{"
            );

            for (int i = 0; i < params.size(); i++) {
                if (i > 0) source.append(", ");
                source.append(javaString(params.get(i).name()));
            }
            source.append("}, new String[]{");
            for (int i = 0; i < params.size(); i++) {
                if (i > 0) source.append(", ");
                source.append(javaString(params.get(i).type()));
            }
            source.append("});\n");

            source.append(
                    "Object result = solution."
            )
                    .append(method)
                    .append("(");

            for (int i = 0;
                 i < params.size();
                 i++) {

                if (i > 0) {
                    source.append(", ");
                }

                source.append("((")
                        .append(
                                javaType(
                                        params.get(i).type()
                                )
                        )
                        .append(") values[")
                        .append(i)
                        .append("])");
            }

            source.append(");\n");

            source.append(
                    "System.out.println(OutputFormatter.format(result));\n"
            );

            source.append("}\n");

            source.append(inputParser());

            source.append(outputFormatter());

            source.append("\n}\n");

            return source.toString();
        }

        private static String extractCandidateClass(
                String candidate) {

            if (candidate == null) {

                throw new IllegalArgumentException(
                        "Candidate code is empty"
                );
            }

            String code =
                    candidate.trim();

            if (code.contains("class Solution")) {

                int start =
                        code.indexOf(
                                "class Solution"
                        );

                int brace =
                        code.indexOf(
                                '{',
                                start
                        );

                if (brace >= 0) {

                    int end =
                            code.lastIndexOf('}');

                    if (end >= brace) {

                        String solution = code.substring(start, end + 1);
                        // A non-static member class cannot be created from Main.main().
                        return solution.replaceFirst("(?m)^\\s*(public\\s+)?class\\s+Solution\\b", "static class Solution");
                    }
                }
            }

            return """
                    static class Solution {
                    %s
                    }
                    """.formatted(code);
        }

        private static String javaType(
                String type) {

            if (type == null) {
                return "Object";
            }

            return switch (
                    type.toLowerCase()
            ) {

                case "int",
                     "integer",
                     "number" ->
                        "int";

                case "long" ->
                        "long";

                case "float" ->
                        "float";

                case "double" ->
                        "double";

                case "bool",
                     "boolean" ->
                        "boolean";

                case "string",
                     "str" ->
                        "String";

                case "int[]",
                     "int array",
                     "array<int>" ->
                        "int[]";

                case "long[]" -> "long[]";
                case "float[]" -> "float[]";
                case "double[]" -> "double[]";
                case "boolean[]" -> "boolean[]";

                case "int[][]",
                     "int matrix",
                     "array<array<int>>" ->
                        "int[][]";

                case "long[][]" -> "long[][]";
                case "float[][]" -> "float[][]";
                case "double[][]" -> "double[][]";
                case "boolean[][]" -> "boolean[][]";
                case "char[][]", "char grid" -> "char[][]";
                case "string[][]" -> "String[][]";

                case "string[]" ->
                        "String[]";

                case "list<int>" ->
                        "List<Integer>";

                case "list<string>" ->
                        "List<String>";

                case "list<list<int>>" ->
                        "List<List<Integer>>";

                case "list<list<string>>" ->
                        "List<List<String>>";

                case "listnode" -> "ListNode";
                case "listnode[]" -> "ListNode[]";
                case "treenode" -> "TreeNode";

                default ->
                        "Object";
            };
        }

        private static String javaString(
                String value) {

            if (value == null) {
                return "\"\"";
            }

            return "\""
                    + value
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\r", "\\r")
                    .replace("\n", "\\n")
                    + "\"";
        }

        private static String nodeDefinitions() {
            return """
                    static class TreeNode {
                        int val; TreeNode left; TreeNode right;
                        TreeNode(int val) { this.val = val; }
                        TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
                    }
                    static class ListNode {
                        int val; ListNode next;
                        ListNode(int val) { this.val = val; }
                        ListNode(int val, ListNode next) { this.val = val; this.next = next; }
                    }
                    """;
        }

        private static String inputParser() {

            return """

                    static class InputParser {

                        static Object[] arguments(String input, String[] names, String[] types) {
                            if (types.length == 0) return new Object[0];
                            String s = input == null ? "" : input.trim();
                            List<String> values = splitArgs(s, types.length);
                            if (types.length == 1 && values.isEmpty() && !s.isEmpty()) {
                                values = List.of(stripName(s));
                            }
                            if (values.size() != types.length) {
                                throw new IllegalArgumentException("Expected " + types.length + " argument(s), received " + values.size() + " for input: " + s);
                            }
                            Object[] result = new Object[types.length];
                            for (int i = 0; i < types.length; i++) {
                                result[i] = parse(stripName(values.get(i)), types[i]);
                            }
                            return result;
                        }

                        static List<String> splitArgs(String raw, int expected) {
                            if (raw == null || raw.isBlank()) return List.of();
                            List<String> commaSplit = split(raw);
                            if (commaSplit.size() == expected) return commaSplit;

                            List<String> lineSplit = splitTopLevelLines(raw);
                            if (lineSplit.size() == expected) return lineSplit;

                            if (commaSplit.size() == 1 && lineSplit.size() > 1) return lineSplit;
                            return commaSplit;
                        }

                        static List<String> splitTopLevelLines(String raw) {
                            List<String> out = new ArrayList<>();
                            if (raw == null || raw.isBlank()) return out;
                            int depth = 0;
                            boolean quoted = false;
                            char quote = 0;
                            StringBuilder current = new StringBuilder();
                            for (int i = 0; i < raw.length(); i++) {
                                char c = raw.charAt(i);
                                if (quoted) {
                                    current.append(c);
                                    if (c == quote && (i == 0 || raw.charAt(i - 1) != 92)) quoted = false;
                                    continue;
                                }
                                if (c == 34 || c == 39) {
                                    quoted = true;
                                    quote = c;
                                    current.append(c);
                                } else if (c == '[') {
                                    depth++;
                                    current.append(c);
                                } else if (c == ']') {
                                    depth--;
                                    current.append(c);
                                } else if ((c == 10 || c == 13) && depth == 0) {
                                    String trimmed = current.toString().trim();
                                    if (!trimmed.isEmpty()) out.add(trimmed);
                                    current.setLength(0);
                                } else {
                                    current.append(c);
                                }
                            }
                            String last = current.toString().trim();
                            if (!last.isEmpty()) out.add(last);
                            return out;
                        }

                        static String stripName(String value) {
                            if (value == null) return "";
                            String v = value.trim();
                            int equals = v.indexOf('=');
                            if (equals >= 0 && !v.startsWith("[") && !v.startsWith(String.valueOf((char)34)) && !v.startsWith("'")) {
                                return v.substring(equals + 1).trim();
                            }
                            return v;
                        }
                        static Object parse(String raw, String type) {
                            String t = type == null ? "object" : type.toLowerCase().replace(" ", "");
                            if (raw.equals("null") || raw.isEmpty()) return switch (t) { case "int", "integer", "number" -> 0; case "long" -> 0L; case "float" -> 0f; case "double" -> 0d; case "boolean", "bool" -> false; default -> null; };
                            return switch (t) {
                                case "int", "integer", "number" -> Integer.parseInt(raw);
                                case "long" -> Long.parseLong(raw.replace("L", ""));
                                case "float" -> Float.parseFloat(raw.replace("f", "").replace("F", ""));
                                case "double" -> Double.parseDouble(raw.replace("d", "").replace("D", ""));
                                case "boolean", "bool" -> Boolean.parseBoolean(raw);
                                case "string", "str" -> unquote(raw);
                                case "int[]", "intarray", "array<int>" -> ints(raw);
                                case "long[]" -> longs(raw);
                                case "float[]" -> floats(raw);
                                case "double[]" -> doubles(raw);
                                case "boolean[]" -> booleans(raw);
                                case "string[]" -> strings(raw);
                                case "int[][]", "intmatrix", "array<array<int>>" -> intMatrix(raw);
                                case "char[][]", "chargrid" -> charMatrix(raw);
                                case "string[][]" -> stringMatrix(raw);
                                case "list<int>" -> integerList(raw);
                                case "list<long>" -> longList(raw);
                                case "list<string>" -> stringList(raw);
                                case "list<list<int>>" -> integerLists(raw);
                                case "list<list<string>>" -> stringLists(raw);
                                case "listnode" -> listNode(raw);
                                case "listnode[]" -> listNodes(raw);
                                case "treenode" -> tree(raw);
                                default -> throw new IllegalArgumentException("UNSUPPORTED_PROBLEM_CONFIGURATION: " + type);
                            };
                        }
                        static List<String> split(String raw) { return splitTopLevel(raw, ','); }
                        static List<String> splitTopLevel(String raw, char delimiter) {
                            List<String> out = new ArrayList<>();
                            if (raw == null || raw.isBlank()) return out;

                            int depth = 0;
                            boolean quoted = false;
                            char quote = 0;
                            StringBuilder current = new StringBuilder();

                            for (int i = 0; i < raw.length(); i++) {
                                char c = raw.charAt(i);

                                if (quoted) {
                                    current.append(c);
                                    // 92 = backslash. Use the numeric value here so the
                                    // generated Main.java cannot lose nested escaping.
                                    if (c == quote &&
                                            (i == 0 || raw.charAt(i - 1) != 92)) {
                                        quoted = false;
                                    }
                                    continue;
                                }

                                // 34 = double quote, 39 = single quote.
                                // Numeric character codes avoid Java text-block escaping
                                // being interpreted before Main.java is generated.
                                if (c == 34 || c == 39) {
                                    quoted = true;
                                    quote = c;
                                    current.append(c);
                                } else if (c == '[') {
                                    depth++;
                                    current.append(c);
                                } else if (c == ']') {
                                    depth--;
                                    current.append(c);
                                } else if (c == delimiter && depth == 0) {
                                    out.add(current.toString().trim());
                                    current.setLength(0);
                                } else {
                                    current.append(c);
                                }
                            }

                            out.add(current.toString().trim());
                            return out;
                        }
                        static List<String> elements(String raw) {
                            String s = raw == null ? "" : raw.trim();
                            if (s.startsWith("[") && s.endsWith("]")) {
                                s = s.substring(1, s.length() - 1).trim();
                            }
                            if (s.isEmpty()) return List.of();
                            List<String> items = split(s);
                            if (items.size() == 1 && s.contains(" ")) {
                                String[] spaceItems = s.split("\\s+");
                                if (spaceItems.length > 1) return Arrays.asList(spaceItems);
                            }
                            return items;
                        }
                        // Character codes avoid nested Java-text-block escaping in generated source.
                        static String unquote(String s) { s = s.trim(); return s.length() >= 2 && ((s.charAt(0) == 34 && s.charAt(s.length() - 1) == 34) || (s.charAt(0) == 39 && s.charAt(s.length() - 1) == 39)) ? s.substring(1, s.length() - 1) : s; }
                        static int[] ints(String s) { List<String> e = elements(s); int[] a = new int[e.size()]; for (int i=0;i<a.length;i++) a[i]=Integer.parseInt(e.get(i)); return a; }
                        static long[] longs(String s) { List<String> e = elements(s); long[] a = new long[e.size()]; for (int i=0;i<a.length;i++) a[i]=Long.parseLong(e.get(i)); return a; }
                        static float[] floats(String s) { List<String> e = elements(s); float[] a = new float[e.size()]; for (int i=0;i<a.length;i++) a[i]=Float.parseFloat(e.get(i)); return a; }
                        static double[] doubles(String s) { List<String> e = elements(s); double[] a = new double[e.size()]; for (int i=0;i<a.length;i++) a[i]=Double.parseDouble(e.get(i)); return a; }
                        static boolean[] booleans(String s) { List<String> e = elements(s); boolean[] a = new boolean[e.size()]; for (int i=0;i<a.length;i++) a[i]=Boolean.parseBoolean(e.get(i)); return a; }
                        static String[] strings(String s) { List<String> e = elements(s); String[] a = new String[e.size()]; for (int i=0;i<a.length;i++) a[i]=unquote(e.get(i)); return a; }
                        static int[][] intMatrix(String s) { List<String> rows=elements(s); int[][] a=new int[rows.size()][]; for(int i=0;i<a.length;i++)a[i]=ints(rows.get(i)); return a; }
                        static char[][] charMatrix(String s) { List<String> rows=elements(s); char[][] a=new char[rows.size()][]; for(int i=0;i<a.length;i++){String[] r=strings(rows.get(i));a[i]=new char[r.length];for(int j=0;j<r.length;j++)a[i][j]=r[j].charAt(0);}return a; }
                        static String[][] stringMatrix(String s) { List<String> rows=elements(s); String[][] a=new String[rows.size()][];for(int i=0;i<a.length;i++)a[i]=strings(rows.get(i));return a; }
                        static List<Integer> integerList(String s) { int[] a=ints(s);List<Integer> out=new ArrayList<>();for(int n:a)out.add(n);return out; }
                        static List<Long> longList(String s) { long[] a=longs(s);List<Long> out=new ArrayList<>();for(long n:a)out.add(n);return out; }
                        static List<String> stringList(String s) { return new ArrayList<>(Arrays.asList(strings(s))); }
                        static List<List<Integer>> integerLists(String s) { List<String> rows=elements(s);List<List<Integer>> out=new ArrayList<>();for(String row:rows)out.add(integerList(row));return out; }
                        static List<List<String>> stringLists(String s) { List<String> rows=elements(s);List<List<String>> out=new ArrayList<>();for(String row:rows)out.add(stringList(row));return out; }
                        static ListNode listNode(String s) { ListNode head=null,tail=null;for(int n:ints(s)){ListNode node=new ListNode(n);if(head==null)head=node;else tail.next=node;tail=node;}return head; }
                        static ListNode[] listNodes(String s) { List<String> values=elements(s);ListNode[] out=new ListNode[values.size()];for(int i=0;i<out.length;i++)out[i]=listNode(values.get(i));return out; }
                        static TreeNode tree(String s) { List<String> values=elements(s);if(values.isEmpty()||values.get(0).equals("null"))return null;TreeNode root=new TreeNode(Integer.parseInt(values.get(0)));Queue<TreeNode> q=new ArrayDeque<>();q.add(root);int i=1;while(!q.isEmpty()&&i<values.size()){TreeNode node=q.remove();if(i<values.size()&&!values.get(i).equals("null")){node.left=new TreeNode(Integer.parseInt(values.get(i)));q.add(node.left);}i++;if(i<values.size()&&!values.get(i).equals("null")){node.right=new TreeNode(Integer.parseInt(values.get(i)));q.add(node.right);}i++;}return root; }
                    }
                    """;
        }

        private static String outputFormatter() {

            return """

                    static class OutputFormatter {

                        static String format(Object value) {

                            if (value == null) {
                                return "null";
                            }

                            if (value instanceof int[] a) {
                                return Arrays.toString(a);
                            }

                            if (value instanceof long[] a) {
                                return Arrays.toString(a);
                            }

                            if (value instanceof double[] a) {
                                return Arrays.toString(a);
                            }

                            if (value instanceof float[] a) {
                                return Arrays.toString(a);
                            }

                            if (value instanceof boolean[] a) {
                                return Arrays.toString(a);
                            }

                            if (value instanceof Object[] a) {
                                return Arrays.deepToString(a);
                            }

                            if (value instanceof Collection<?> c) {
                                return c.toString();
                            }

                            if (value instanceof ListNode node) {
                                List<Integer> values = new ArrayList<>();
                                while (node != null) { values.add(node.val); node = node.next; }
                                return values.toString();
                            }

                            if (value instanceof TreeNode root) {
                                List<String> values = new ArrayList<>(); Queue<TreeNode> queue = new LinkedList<>(); queue.add(root);
                                while (!queue.isEmpty()) { TreeNode node = queue.remove(); if (node == null) { values.add("null"); continue; } values.add(String.valueOf(node.val)); queue.add(node.left); queue.add(node.right); }
                                while (!values.isEmpty() && values.get(values.size() - 1).equals("null")) values.remove(values.size() - 1);
                                return values.toString();
                            }

                            return String.valueOf(value);
                        }
                    }
                    """;
        }
    }

    /*
     * ---------------------------------------------------------
     * Python method harness
     * ---------------------------------------------------------
     */
    private static final class PythonHarnessGenerator {

        static String generate(
                CodingProblem problem,
                String candidate) {

            String method = problem != null ? problem.getMethodName() : null;
            if (method == null || method.isBlank() || "solve".equalsIgnoreCase(method)) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("def\\s+([a-zA-Z_]\\w*)\\s*\\(self").matcher(candidate);
                if (m.find()) {
                    method = m.group(1);
                } else if (problem != null && problem.getTemplates() != null && problem.getTemplates().get("python") != null) {
                    java.util.regex.Matcher m2 = java.util.regex.Pattern.compile("def\\s+([a-zA-Z_]\\w*)\\s*\\(self").matcher(problem.getTemplates().get("python"));
                    if (m2.find()) {
                        method = m2.group(1);
                    }
                }
            }
            if (method == null || method.isBlank()) {
                method = "solve";
            }

            // Input is read from stdin so the program is prepared once per submission
            // and simply re-executed per test case.
            return """
                    import ast
                    import sys

                    %s

                    raw_input = sys.stdin.read().strip()

                    def parse_val(s):
                        s = s.strip()
                        if '=' in s and not s.startswith('[') and not s.startswith('{') and not s.startswith('"'):
                            s = s.split('=', 1)[1].strip()
                        try:
                            return ast.literal_eval(s)
                        except Exception:
                            return s

                    lines = [l.strip() for l in raw_input.split('\\n') if l.strip()]

                    solution = Solution()

                    if len(lines) > 1:
                        args = [parse_val(l) for l in lines]
                        result = solution.%s(*args)
                    else:
                        parsed = parse_val(raw_input)
                        if isinstance(parsed, tuple):
                            result = solution.%s(*parsed)
                        else:
                            result = solution.%s(parsed)

                    print(result)
                    """.formatted(
                    candidate,
                    method,
                    method,
                    method
            );
        }

    }

    /*
     * ---------------------------------------------------------
     * JavaScript method harness
     * ---------------------------------------------------------
     */
    private static final class JavaScriptHarnessGenerator {

        static String generate(
                CodingProblem problem,
                String candidate) {

            String method =
                    problem.getMethodName() == null
                            ? "solve"
                            : problem.getMethodName();

            // Input is read from stdin (fd 0) so the program is prepared once per
            // submission and simply re-executed per test case.
            return """
                    %s

                    const rawInput =
                        require('fs').readFileSync(0, 'utf8').trim();

                    let parsed;

                    try {
                        parsed = JSON.parse(rawInput);
                    } catch {
                        parsed = rawInput;
                    }

                    const solution = new Solution();

                    const args =
                        Array.isArray(parsed)
                            ? [parsed]
                            : [parsed];

                    const result =
                        solution.%s(...args);

                    console.log(
                        JSON.stringify(result)
                    );
                    """.formatted(
                    candidate,
                    method
            );
        }

    }

    /*
     * ---------------------------------------------------------
     * C++ method harness
     * ---------------------------------------------------------
     *
     * NOTE:
     * C++ METHOD mode still requires a typed generated
     * harness based on the problem's ParameterSpec.
     *
     * STDIN/SCRIPT/CONTEST modes execute normally.
     */
    private static final class CppHarnessGenerator {

        static String generate(
                CodingProblem problem,
                String candidate) {

            return """
                    #include <bits/stdc++.h>
                    using namespace std;

                    %s

                    int main() {

                        // METHOD-mode C++ execution requires
                        // a typed generated harness for the
                        // specific parameter signature.

                        // This is intentionally kept explicit
                        // rather than pretending that a generic
                        // harness can safely infer C++ types.

                        return 0;
                    }
                    """.formatted(candidate);
        }
    }
}