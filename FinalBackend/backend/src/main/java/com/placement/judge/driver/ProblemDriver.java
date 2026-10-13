package com.placement.judge.driver;

import com.placement.judge.ProblemDefinition;

public interface ProblemDriver {
    String buildSource(ProblemDefinition problem, String userCode, String input);
}
