package com.placement.entity;

public enum ExecutionMode {
    METHOD,
    STDIN,
    SCRIPT,
    CONTEST,
    /** SQL query problem: schemaDdl holds the DDL/seed data used to set up the tables, and
     *  expectedOutput holds the admin-authored reference result set the student's query is
     *  checked against. No method signature (methodName/returnType/parameters) applies here. */
    SQL,
    /** Pandas/DataFrame problem: schemaDdl documents the input DataFrame's columns/dtypes (or the
     *  setup snippet that builds it), and expectedOutput holds the reference result. Same
     *  "no method signature" shape as SQL. */
    DATAFRAME
}
