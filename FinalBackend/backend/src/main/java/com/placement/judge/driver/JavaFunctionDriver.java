package com.placement.judge.driver;

import com.placement.judge.ProblemDefinition;
import org.springframework.stereotype.Component;

/** Deliberately small template. Input construction is selected from trusted metadata, never user code. */
@Component
public class JavaFunctionDriver implements ProblemDriver {
    @Override public String buildSource(ProblemDefinition problem, String userCode, String input) {
        throw new UnsupportedOperationException("Java FUNCTION drivers require the judge-runtime artifact mounted in the sandbox");
    }
}
