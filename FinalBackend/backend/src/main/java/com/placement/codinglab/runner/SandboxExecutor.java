package com.placement.codinglab.runner;

import com.placement.codinglab.entity.CodingRuntime;

import java.util.List;
import java.util.Map;

/**
 * Runs one project in isolation and reports what happened. The only implementation shipped is
 * {@link DockerSandboxExecutor}; the seam exists so a remote runner (Judge0 / a self-hosted runner service)
 * can be added for hosts without a Docker socket without touching any calling code.
 *
 * <p>An executor NEVER decides pass/fail - it returns the raw build outcome and the JUnit-XML report; scoring
 * lives in {@link RequirementScorer} so it is identical for every runtime.
 */
public interface SandboxExecutor {

    enum Suite {
        PUBLIC("public"), HIDDEN("hidden");
        private final String dir;
        Suite(String dir) { this.dir = dir; }
        public String dir() { return dir; }
    }

    /** {@code files} must already contain every file to place on disk (student/reference code + this suite's tests). */
    record Request(CodingRuntime runtime, Suite suite, Map<String, String> files, int memoryLimitMb,
                   int timeoutSeconds, boolean domEnvironment) {}

    enum Outcome { COMPLETED, TIMED_OUT, UNAVAILABLE, BUSY }

    /**
     * @param userMessage  safe to show to a candidate ("the runner is unavailable")
     * @param adminMessage actionable detail for an administrator ("image X is not built - run ...")
     */
    record Result(Outcome outcome, boolean buildOk, String buildLog, String reportXml, String runLog,
                  int runtimeMs, String userMessage, String adminMessage) {

        public static Result unavailable(String userMessage, String adminMessage) {
            return new Result(Outcome.UNAVAILABLE, false, "", null, "", 0, userMessage, adminMessage);
        }

        public static Result busy() {
            String m = "The code runner is busy right now. Please try again in a few seconds.";
            return new Result(Outcome.BUSY, false, "", null, "", 0, m, m);
        }
    }

    record RunnerStatus(boolean ready, boolean dockerReachable, Map<String, Boolean> images, List<String> problems) {}

    Result execute(Request request);

    RunnerStatus status();
}
