package com.placement.judge.driver;

import com.placement.entity.ExecutionMode;
import com.placement.judge.ProblemDefinition;
import org.springframework.stereotype.Component;

@Component
public class DriverFactory {
    private final JavaFunctionDriver javaFunctionDriver;
    private final JavaStdinDriver javaStdinDriver;
    public DriverFactory(JavaFunctionDriver javaFunctionDriver, JavaStdinDriver javaStdinDriver) { this.javaFunctionDriver = javaFunctionDriver; this.javaStdinDriver = javaStdinDriver; }
    public ProblemDriver forProblem(ProblemDefinition problem) {
        if (!"java".equalsIgnoreCase(problem.language())) throw new IllegalArgumentException("Unsupported language driver: " + problem.language());
        return problem.executionMode() == ExecutionMode.STDIN ? javaStdinDriver : javaFunctionDriver;
    }
}
