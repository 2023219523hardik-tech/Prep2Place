package com.placement.judge;

import com.placement.entity.ExecutionMode;
import com.placement.entity.ParameterSpec;
import java.util.List;

/** Immutable contract supplied by the platform, never inferred from candidate source. */
public record ProblemDefinition(Long problemId, String language, ExecutionMode executionMode,
                                String methodName, List<ParameterSpec> parameters, String returnType,
                                DriverType driverType, int timeLimitMs, int memoryLimitMb) {
    public enum DriverType { FUNCTION, STDIN_STDOUT }
}
