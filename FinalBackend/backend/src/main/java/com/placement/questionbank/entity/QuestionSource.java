package com.placement.questionbank.entity;

/**
 * Every external (or internal) provider the Question Intelligence system can pull from.
 * Adding a new provider means adding an enum value + a QuestionSourceAdapter implementation -
 * nothing else in the pipeline needs to change (see {@link com.placement.questionbank.adapter.QuestionSourceAdapter}).
 */
public enum QuestionSource {
    TUF,          // Take U Forward / Striver sheets
    LEETCODE,
    HACKERRANK,
    GFG,          // GeeksforGeeks
    INTERNAL      // Prep2Place's own authored/seeded questions
}
