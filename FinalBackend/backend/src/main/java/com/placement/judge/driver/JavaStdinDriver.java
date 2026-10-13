package com.placement.judge.driver;

import com.placement.judge.ProblemDefinition;
import org.springframework.stereotype.Component;

/** STDIN problems own Main; the judge supplies raw input without source transformation. */
@Component
public class JavaStdinDriver implements ProblemDriver {
    @Override public String buildSource(ProblemDefinition problem, String userCode, String input) { return userCode; }
}
