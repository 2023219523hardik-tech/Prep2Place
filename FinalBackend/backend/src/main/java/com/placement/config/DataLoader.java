package com.placement.config;

import com.placement.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.service.QuestionSyncService;
import com.placement.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final JobRoleRepository jobRoleRepository;
    private final QuestionRepository questionRepository;
    private final CodingProblemRepository codingProblemRepository;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final AptitudeQuestionSeedLoader aptitudeQuestionSeedLoader;
    private final ScoreWeightConfigRepository weightConfigRepository;
    private final PasswordEncoder passwordEncoder;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final QuestionSyncService questionSyncService;

    @Override
    @Transactional
    public void run(String... args) {
        try {
            runInternal();
        } catch (Exception e) {
            log.warn("Seed data loading skipped due to an issue (app will still start without pre-seeded data): {}",
                    e.getMessage());
        }
    }

    private void runInternal() {
        // Wrapping condition, not an early return: this must not gate everything below it in this
        // method (see the canonical_question check further down) - a database that already has
        // users from an earlier run (e.g. anyone who already tested the postgres profile before
        // Company Vault's real seed data was added) must still get that data on the next boot,
        // not skip it forever because users already exist.
        if (userRepository.count() == 0) {

        weightConfigRepository.save(ScoreWeightConfig.builder().build());

        userRepository.save(User.builder()
                .email("admin@placement.io").password(passwordEncoder.encode("Admin@123"))
                .fullName("Placement Admin").role(Role.ADMIN).active(true).build());

        JobRole backend = jobRoleRepository.save(JobRole.builder()
                .title("Backend Developer").domain("Software Development")
                .description("Server-side application development with REST APIs and databases.")
                .requiredSkills("Java,Spring Boot,SQL,DSA,REST API,Git").build());

        JobRole frontend = jobRoleRepository.save(JobRole.builder()
                .title("Frontend Developer").domain("Software Development")
                .description("Building user interfaces and client-side web applications.")
                .requiredSkills("JavaScript,React,Next.js,HTML,CSS,Git").build());

        jobRoleRepository.save(JobRole.builder()
                .title("Data Analyst").domain("Data")
                .description("Analyzing data to generate business insights.")
                .requiredSkills("SQL,Python,Excel,Statistics,Data Visualization").build());

        // Section 9: needed so the mid-interview domain-specific coding challenge has an ML-track
        // role to actually detect - none existed before.
        jobRoleRepository.save(JobRole.builder()
                .title("Machine Learning Engineer").domain("Machine Learning")
                .description("Building and deploying applied machine learning models.")
                .requiredSkills("Python,NumPy,Pandas,Scikit-learn,Statistics,SQL").build());

        User student = userRepository.save(User.builder()
                .email("student@placement.io").password(passwordEncoder.encode("Student@123"))
                .fullName("Aarav Sharma").role(Role.STUDENT).active(true).build());

        StudentProfile profile = StudentProfile.builder()
                .user(student).college("NIT Delhi").degree("B.Tech").branch("Computer Science")
                .graduationYear(2026).cgpa(8.2).targetRole(backend).build();
        profile.getSkills().add(Skill.builder().profile(profile).name("Java").proficiency(3).build());
        profile.getSkills().add(Skill.builder().profile(profile).name("SQL").proficiency(2).build());
        profile.getSkills().add(Skill.builder().profile(profile).name("Git").proficiency(4).build());
        profile.getProjects().add(ProjectEntry.builder().profile(profile)
                .title("Placement Prep Tracker").description("A tool to track DSA and interview practice.")
                .techStack("Spring Boot, React").link("https://github.com/example/prep-tracker").build());
        studentProfileRepository.save(profile);

        questionRepository.save(Question.builder().text("Explain the difference between an ArrayList and a LinkedList in Java.")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.EASY).role(backend)
                .expectedKeywords("array,linked list,index,insertion,memory,contiguous").published(true).build());

        questionRepository.save(Question.builder().text("What is the difference between SQL JOIN types (INNER, LEFT, RIGHT)?")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(backend)
                .expectedKeywords("inner join,left join,right join,matching rows,null").published(true).build());

        questionRepository.save(Question.builder().text("Describe REST API design principles you follow.")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(backend)
                .expectedKeywords("stateless,resource,http methods,status codes,json,idempotent").published(true).build());

        questionRepository.save(Question.builder().text("Tell me about yourself and your career goals.")
                .category(QuestionCategory.HR).difficulty(Difficulty.EASY)
                .expectedKeywords("background,skills,goals,strengths,experience").published(true).build());

        questionRepository.save(Question.builder().text("Describe a time you worked in a team to solve a difficult problem.")
                .category(QuestionCategory.COMMUNICATION).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("team,collaboration,challenge,solution,result,communication").published(true).build());

        questionRepository.save(Question.builder().text("What is React's virtual DOM and why is it used?")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(frontend)
                .expectedKeywords("virtual dom,diffing,reconciliation,performance,real dom").published(true).build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Two Sum").topic("Arrays").difficulty(Difficulty.EASY)
                .statement("Given an array of integers and a target, return indices of the two numbers that add up to target.")
                .methodName("twoSum").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers"), new ParameterSpec("target", "int", "target sum")))
                .sampleInput("[2,7,11,15], target=9").sampleOutput("[0,1]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Reverse a Linked List").topic("Linked List").difficulty(Difficulty.MEDIUM)
                .statement("Reverse a singly linked list and return the new head.")
                .methodName("reverseList").returnType("listnode")
                .parameters(List.of(new ParameterSpec("head", "listnode", "head of the list")))
                .sampleInput("1->2->3->4->5").sampleOutput("5->4->3->2->1").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Longest Common Subsequence").topic("Dynamic Programming").difficulty(Difficulty.HARD)
                .statement("Find the length of the longest common subsequence between two strings.")
                .methodName("longestCommonSubsequence").returnType("int")
                .parameters(List.of(new ParameterSpec("text1", "string", "first string"), new ParameterSpec("text2", "string", "second string")))
                .sampleInput("abcde, ace").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Maximum Subarray (Kadane's)").topic("Arrays").difficulty(Difficulty.EASY)
                .statement("Find the contiguous subarray with the largest sum and return its sum.")
                .methodName("maxSubArray").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[-2,1,-3,4,-1,2,1,-5,4]").sampleOutput("6").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Remove Duplicates from Sorted Array").topic("Arrays").difficulty(Difficulty.EASY)
                .statement("Remove duplicates in-place from a sorted array and return the new length.")
                .methodName("removeDuplicates").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "sorted array")))
                .sampleInput("[1,1,2,2,3]").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Valid Parentheses").topic("Stack").difficulty(Difficulty.EASY)
                .statement("Determine if the input string containing just (){}[] has balanced parentheses.")
                .methodName("isValid").returnType("boolean")
                .parameters(List.of(new ParameterSpec("s", "string", "string of brackets")))
                .sampleInput("()[]{}").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Next Permutation").topic("Arrays").difficulty(Difficulty.MEDIUM)
                .statement("Rearrange array into lexicographically next greater permutation of numbers.")
                .methodName("nextPermutation").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[1,2,3]").sampleOutput("[1,3,2]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("3Sum").topic("Arrays").difficulty(Difficulty.MEDIUM)
                .statement("Find all unique triplets in an array which give sum of zero.")
                .methodName("threeSum").returnType("list<list<int>>")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[-1,0,1,2,-1,-4]").sampleOutput("[[-1,-1,2],[-1,0,1]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Merge Intervals").topic("Arrays").difficulty(Difficulty.MEDIUM)
                .statement("Merge all overlapping intervals and return an array of merged intervals.")
                .methodName("merge").returnType("int[][]")
                .parameters(List.of(new ParameterSpec("intervals", "int[][]", "array of intervals")))
                .sampleInput("[[1,3],[2,6],[8,10],[15,18]").sampleOutput("[[1,6],[8,10],[15,18]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Rotate Image").topic("Arrays").difficulty(Difficulty.MEDIUM)
                .statement("Rotate n x n 2D matrix representing an image by 90 degrees clockwise in-place.")
                .methodName("rotate").returnType("int[][]")
                .parameters(List.of(new ParameterSpec("matrix", "int[][]", "n x n matrix")))
                .sampleInput("[[1,2,3],[4,5,6],[7,8,9]").sampleOutput("[[7,4,1],[8,5,2],[9,6,3]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Set Matrix Zeroes").topic("Arrays").difficulty(Difficulty.MEDIUM)
                .statement("If an element is 0, set its entire row and column to 0 in-place.")
                .methodName("setZeroes").returnType("int[][]")
                .parameters(List.of(new ParameterSpec("matrix", "int[][]", "m x n matrix")))
                .sampleInput("[[0,1,2,0],[3,4,5,2],[1,3,1,5]]").sampleOutput("[[0,0,0,0],[0,4,5,0],[0,3,1,0]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Valid Anagram").topic("Strings").difficulty(Difficulty.EASY)
                .statement("Given two strings s and t, return true if t is an anagram of s.")
                .methodName("isAnagram").returnType("boolean")
                .parameters(List.of(new ParameterSpec("s", "string", "first string"), new ParameterSpec("t", "string", "second string")))
                .sampleInput("s=\"anagram\", t=\"nagaram\"").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Binary Search").topic("Binary Search").difficulty(Difficulty.EASY)
                .statement("Given a sorted array of distinct integers and a target, return the index if the target is found.")
                .methodName("search").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "sorted array"), new ParameterSpec("target", "int", "value to find")))
                .sampleInput("[-1,0,3,5,9,12], target=9").sampleOutput("4").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Longest Substring Without Repeating Characters").topic("Strings").difficulty(Difficulty.MEDIUM)
                .statement("Find the length of the longest substring without repeating characters.")
                .methodName("lengthOfLongestSubstring").returnType("int")
                .parameters(List.of(new ParameterSpec("s", "string", "input string")))
                .sampleInput("\"abcabcbb\"").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Longest Palindromic Substring").topic("Strings").difficulty(Difficulty.MEDIUM)
                .statement("Return the longest palindromic substring in s.")
                .methodName("longestPalindrome").returnType("string")
                .parameters(List.of(new ParameterSpec("s", "string", "input string")))
                .sampleInput("\"babad\"").sampleOutput("\"bab\" or \"aba\"").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Group Anagrams").topic("Strings").difficulty(Difficulty.MEDIUM)
                .statement("Given an array of strings, group anagrams together.")
                .methodName("groupAnagrams").returnType("list<list<string>>")
                .parameters(List.of(new ParameterSpec("strs", "string[]", "array of strings")))
                .sampleInput("[\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]").sampleOutput("[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Middle of the Linked List").topic("LinkedList").difficulty(Difficulty.EASY)
                .statement("Return the middle node of a singly linked list.")
                .methodName("middleNode").returnType("listnode")
                .parameters(List.of(new ParameterSpec("head", "listnode", "head of the list")))
                .sampleInput("[1,2,3,4,5]").sampleOutput("[3,4,5]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Linked List Cycle").topic("LinkedList").difficulty(Difficulty.EASY)
                .statement("Determine if a linked list has a cycle in it.")
                .methodName("hasCycle").returnType("boolean")
                .parameters(List.of(new ParameterSpec("head", "listnode", "head of the list")))
                .sampleInput("head = [3,2,0,-4], pos=1").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Merge Two Sorted Lists").topic("LinkedList").difficulty(Difficulty.EASY)
                .statement("Merge two sorted linked lists and return it as a sorted list.")
                .methodName("mergeTwoLists").returnType("listnode")
                .parameters(List.of(new ParameterSpec("l1", "listnode", "first sorted list"), new ParameterSpec("l2", "listnode", "second sorted list")))
                .sampleInput("[1,2,4], [1,3,4]").sampleOutput("[1,1,2,3,4,4]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Remove Nth Node From End").topic("LinkedList").difficulty(Difficulty.MEDIUM)
                .statement("Remove the nth node from the end of the linked list and return its head.")
                .methodName("removeNthFromEnd").returnType("listnode")
                .parameters(List.of(new ParameterSpec("head", "listnode", "head of the list"), new ParameterSpec("n", "int", "position from end")))
                .sampleInput("[1,2,3,4,5], n=2").sampleOutput("[1,2,3,5]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Min Stack").topic("Stack").difficulty(Difficulty.MEDIUM)
                .statement("Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.")
                .methodName("getMin").returnType("int")
                .parameters(List.of(new ParameterSpec("pushValues", "int[]", "sequence of values pushed onto the stack")))
                .sampleInput("push -2, push 0, push -3, getMin").sampleOutput("-3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Invert Binary Tree").topic("Trees").difficulty(Difficulty.EASY)
                .statement("Invert a binary tree.")
                .methodName("invertTree").returnType("treenode")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("[4,2,7,1,3,6,9]").sampleOutput("[4,7,2,9,6,3,1]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Maximum Depth of Binary Tree").topic("Trees").difficulty(Difficulty.EASY)
                .statement("Given the root of a binary tree, return its maximum depth.")
                .methodName("maxDepth").returnType("int")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("[3,9,20,null,null,15,7]").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Same Tree").topic("Trees").difficulty(Difficulty.EASY)
                .statement("Check if two binary trees are the same or not.")
                .methodName("isSameTree").returnType("boolean")
                .parameters(List.of(new ParameterSpec("p", "treenode", "root of first tree"), new ParameterSpec("q", "treenode", "root of second tree")))
                .sampleInput("p=[1,2,3], q=[1,2,3]").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Lowest Common Ancestor of a BST").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Find the lowest common ancestor of two given nodes in a BST.")
                .methodName("lowestCommonAncestor").returnType("treenode")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the BST"), new ParameterSpec("p", "treenode", "first node"), new ParameterSpec("q", "treenode", "second node")))
                .sampleInput("root=[6,2,8,0,4,7,9,null,null,3,5], p=2, q=8").sampleOutput("6").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Diameter of Binary Tree").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Return the diameter of a binary tree.")
                .methodName("diameterOfBinaryTree").returnType("int")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("[1,2,3,4,5]").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Validate Binary Search Tree").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Determine if a binary tree is a valid BST.")
                .methodName("isValidBST").returnType("boolean")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("[2,1,3]").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Binary Tree Level Order Traversal").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Return the level order traversal of nodes' values.")
                .methodName("levelOrder").returnType("list<list<int>>")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("[3,9,20,null,null,15,7]").sampleOutput("[[3],[9,20],[15,7]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Clone Graph").topic("Graphs").difficulty(Difficulty.MEDIUM)
                .statement("Return a deep copy of a connected undirected graph.")
                .methodName("cloneGraph").returnType("graphnode")
                .parameters(List.of(new ParameterSpec("node", "graphnode", "reference node of the graph")))
                .sampleInput("adjList = [[2,4],[1,3],[2,4],[1,3]]").sampleOutput("[[2,4],[1,3],[2,4],[1,3]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Number of Islands").topic("Graphs").difficulty(Difficulty.MEDIUM)
                .statement("Count the number of islands in an m x n 2D binary grid.")
                .methodName("numIslands").returnType("int")
                .parameters(List.of(new ParameterSpec("grid", "char[][]", "grid of '1' land and '0' water")))
                .sampleInput("grid=[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]").sampleOutput("1").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Course Schedule").topic("Graphs").difficulty(Difficulty.MEDIUM)
                .statement("Return true if you can finish all courses given prerequisites, otherwise false.")
                .methodName("canFinish").returnType("boolean")
                .parameters(List.of(new ParameterSpec("numCourses", "int", "number of courses"), new ParameterSpec("prerequisites", "int[][]", "prerequisite pairs")))
                .sampleInput("numCourses=2, prerequisites=[[1,0]]").sampleOutput("true").build());

        CodingProblem floodFill = CodingProblem.builder()
                .title("Flood Fill").topic("Graphs").difficulty(Difficulty.EASY)
                .statement("An image is represented by an m x n integer grid image where image[i][j] represents the pixel value of the image. You are also given three integers sr, sc, and color. You should perform a flood fill on the image starting from the pixel image[sr][sc].\n\nTo perform a flood fill, consider the starting pixel, plus any pixels connected 4-directionally to the starting pixel of the same color as the starting pixel, plus any pixels connected 4-directionally to those pixels (also with the same color), and so on. Replace the color of all of the aforementioned pixels with color.\n\nReturn the modified image after performing the flood fill.")
                .methodName("floodFill").returnType("int[][]")
                .parameters(List.of(new ParameterSpec("image", "int[][]", "image grid"), new ParameterSpec("sr", "int", "starting row"), new ParameterSpec("sc", "int", "starting column"), new ParameterSpec("color", "int", "fill color")))
                .sampleInput("image = [[1, 1, 1], [1, 1, 0], [1, 0, 1]], sr = 1, sc = 1, color = 2").sampleOutput("[[2, 2, 2], [2, 2, 0], [2, 0, 1]]").build();
        floodFill.getExamples().add(ProblemExample.builder()
                .problem(floodFill).ordinal(0).title("Example 1")
                .input("image = [[1, 1, 1], [1, 1, 0], [1, 0, 1]], sr = 1, sc = 1, color = 2")
                .output("[[2, 2, 2], [2, 2, 0], [2, 0, 1]]")
                .explanation("From the center of the image with position (sr, sc) = (1, 1) (i.e., the middle pixel), all pixels connected by a path of the same color as the starting pixel are colored with the new color 2.")
                .hidden(false).build());
        floodFill.getExamples().add(ProblemExample.builder()
                .problem(floodFill).ordinal(1).title("Example 2")
                .input("image = [[0, 0, 0], [0, 0, 0]], sr = 0, sc = 0, color = 0")
                .output("[[0, 0, 0], [0, 0, 0]]")
                .explanation("The starting pixel is already colored 0, so no changes are made to the image.")
                .hidden(false).build());
        floodFill.getConstraints().add(ProblemConstraint.builder().problem(floodFill).ordinal(0).text("m == image.length, n == image[i].length").build());
        floodFill.getConstraints().add(ProblemConstraint.builder().problem(floodFill).ordinal(1).text("1 <= m, n <= 50").build());
        floodFill.getConstraints().add(ProblemConstraint.builder().problem(floodFill).ordinal(2).text("0 <= image[i][j], color < 65536").build());
        floodFill.getConstraints().add(ProblemConstraint.builder().problem(floodFill).ordinal(3).text("0 <= sr < m, 0 <= sc < n").build());
        codingProblemRepository.save(floodFill);

        codingProblemRepository.save(CodingProblem.builder()
                .title("Climbing Stairs").topic("DP").difficulty(Difficulty.EASY)
                .statement("You are climbing a staircase. It takes n steps to reach the top. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top?")
                .methodName("climbStairs").returnType("int")
                .parameters(List.of(new ParameterSpec("n", "int", "number of steps")))
                .sampleInput("n=3").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Coin Change").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Return the fewest number of coins that you need to make up that amount.")
                .methodName("coinChange").returnType("int")
                .parameters(List.of(new ParameterSpec("coins", "int[]", "coin denominations"), new ParameterSpec("amount", "int", "target amount")))
                .sampleInput("coins=[1,2,5], amount=11").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("House Robber").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Determine the maximum amount of money you can rob tonight without alerting the police.")
                .methodName("rob").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "money at each house")))
                .sampleInput("[1,2,3,1]").sampleOutput("4").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Word Break").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Given a string s and a dictionary of words, return true if s can be segmented into a space-separated sequence of one or more dictionary words.")
                .methodName("wordBreak").returnType("boolean")
                .parameters(List.of(new ParameterSpec("s", "string", "input string"), new ParameterSpec("wordDict", "list<string>", "dictionary of words")))
                .sampleInput("s=\"leetcode\", wordDict=[\"leet\",\"code\"]").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Decode Ways").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Return the number of ways to decode a string of digits into letters using A-Z mapped 1-26.")
                .methodName("numDecodings").returnType("int")
                .parameters(List.of(new ParameterSpec("s", "string", "string of digits")))
                .sampleInput("s=\"12\"").sampleOutput("2").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Palindromic Substrings").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Count how many palindromic substrings in this string.")
                .methodName("countSubstrings").returnType("int")
                .parameters(List.of(new ParameterSpec("s", "string", "input string")))
                .sampleInput("\"aaa\"").sampleOutput("6").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Minimum Path Sum").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Find a path from top left to bottom right which minimizes the sum of all numbers along its path in m x n grid.")
                .methodName("minPathSum").returnType("int")
                .parameters(List.of(new ParameterSpec("grid", "int[][]", "m x n grid of non-negative numbers")))
                .sampleInput("grid=[[1,3,1],[1,5,1],[4,2,1]]").sampleOutput("7").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Word Search").topic("Backtracking").difficulty(Difficulty.MEDIUM)
                .statement("Given an m x n grid of characters board and a string word, return true if word exists in the grid.")
                .methodName("exist").returnType("boolean")
                .parameters(List.of(new ParameterSpec("board", "char[][]", "grid of characters"), new ParameterSpec("word", "string", "word to find")))
                .sampleInput("board=[[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word=\"ABCCED\"").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Subsets").topic("Backtracking").difficulty(Difficulty.MEDIUM)
                .statement("Given an integer array nums of unique elements, return all possible subsets (the power set).")
                .methodName("subsets").returnType("list<list<int>>")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of unique elements")))
                .sampleInput("[1,2,3]").sampleOutput("[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Permutations").topic("Backtracking").difficulty(Difficulty.MEDIUM)
                .statement("Given an array nums of distinct integers, return all the possible permutations.")
                .methodName("permute").returnType("list<list<int>>")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of distinct integers")))
                .sampleInput("[1,2,3]").sampleOutput("[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Kth Largest Element in an Array").topic("Heaps").difficulty(Difficulty.MEDIUM)
                .statement("Return the kth largest element in the array.")
                .methodName("findKthLargest").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers"), new ParameterSpec("k", "int", "k-th position")))
                .sampleInput("[3,2,1,5,6,4], k=2").sampleOutput("5").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Search in Rotated Sorted Array").topic("Binary Search").difficulty(Difficulty.MEDIUM)
                .statement("Search for a target value in the rotated sorted array and return its index.")
                .methodName("search").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "rotated sorted array"), new ParameterSpec("target", "int", "value to find")))
                .sampleInput("nums=[4,5,6,7,0,1,2], target=0").sampleOutput("4").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Find Minimum in Rotated Sorted Array").topic("Binary Search").difficulty(Difficulty.MEDIUM)
                .statement("Find the minimum element in a rotated sorted array.")
                .methodName("findMin").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "rotated sorted array")))
                .sampleInput("[3,4,5,1,2]").sampleOutput("1").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Median of Two Sorted Arrays").topic("Binary Search").difficulty(Difficulty.HARD)
                .statement("Find the median of the two sorted arrays with overall run time complexity O(log (m+n)).")
                .methodName("findMedianSortedArrays").returnType("double")
                .parameters(List.of(new ParameterSpec("nums1", "int[]", "first sorted array"), new ParameterSpec("nums2", "int[]", "second sorted array")))
                .sampleInput("nums1=[1,3], nums2=[2]").sampleOutput("2.00000").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Trapping Rain Water").topic("Two Pointers").difficulty(Difficulty.HARD)
                .statement("Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.")
                .methodName("trap").returnType("int")
                .parameters(List.of(new ParameterSpec("height", "int[]", "elevation map")))
                .sampleInput("[0,1,0,2,1,0,1,3,2,1,2,1]").sampleOutput("6").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Merge k Sorted Lists").topic("Heaps").difficulty(Difficulty.HARD)
                .statement("Merge all the given k sorted linked lists and return it as one sorted list.")
                .methodName("mergeKLists").returnType("listnode")
                .parameters(List.of(new ParameterSpec("lists", "listnode[]", "array of sorted lists")))
                .sampleInput("lists=[[1,4,5],[1,3,4],[2,6]]").sampleOutput("[1,1,2,3,4,4,5,6]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Edit Distance").topic("DP").difficulty(Difficulty.HARD)
                .statement("Find the minimum number of operations required to convert word1 to word2.")
                .methodName("minDistance").returnType("int")
                .parameters(List.of(new ParameterSpec("word1", "string", "first word"), new ParameterSpec("word2", "string", "second word")))
                .sampleInput("word1=\"horse\", word2=\"ros\"").sampleOutput("3").build());

        questionRepository.save(Question.builder().text("Explain the difference between an ArrayList and a LinkedList in Java.")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.EASY).role(backend)
                .expectedKeywords("array,linked list,index,insertion,memory,contiguous").published(true).build());

        questionRepository.save(Question.builder().text("What is the difference between SQL JOIN types (INNER, LEFT, RIGHT)?")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(backend)
                .expectedKeywords("inner join,left join,right join,matching rows,null").published(true).build());

        questionRepository.save(Question.builder().text("Describe REST API design principles you follow.")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(backend)
                .expectedKeywords("stateless,resource,http methods,status codes,json,idempotent").published(true).build());

        questionRepository.save(Question.builder().text("Tell me about yourself and your career goals.")
                .category(QuestionCategory.HR).difficulty(Difficulty.EASY)
                .expectedKeywords("background,skills,goals,strengths,experience").published(true).build());

        questionRepository.save(Question.builder().text("Describe a time you worked in a team to solve a difficult problem.")
                .category(QuestionCategory.COMMUNICATION).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("team,collaboration,challenge,solution,result,communication").published(true).build());

        questionRepository.save(Question.builder().text("What is React's virtual DOM and why is it used?")
                .category(QuestionCategory.TECHNICAL).difficulty(Difficulty.MEDIUM).role(frontend)
                .expectedKeywords("virtual dom,diffing,reconciliation,performance,real dom").published(true).build());

        questionRepository.save(Question.builder().text("What is object-oriented programming? Explain its four pillars.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.EASY)
                .expectedKeywords("encapsulation,abstraction,inheritance,polymorphism,object,class").published(true).build());

        questionRepository.save(Question.builder().text("What is the difference between overloading and overriding in OOP?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.EASY)
                .expectedKeywords("compile time,runtime,polymorphism,method signature,return type").published(true).build());

        questionRepository.save(Question.builder().text("Explain Interface vs Abstract Class in Java. When would you use each?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.EASY)
                .expectedKeywords("interface,abstract class,multiple inheritance,implementation,contract").published(true).build());

        questionRepository.save(Question.builder().text("What is a HashMap in Java? How does it handle collisions?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("hash table,hash code,bucket,chaining,collision,linked list").published(true).build());

        questionRepository.save(Question.builder().text("Explain ACID properties in DBMS with examples.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("atomicity,consistency,isolation,durability,transaction,database").published(true).build());

        questionRepository.save(Question.builder().text("What is the difference between SQL and NoSQL databases? Give examples of each.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("relational,non relational,structured,unstructured,scaling,mongodb,postgres").published(true).build());

        questionRepository.save(Question.builder().text("Explain different types of indexing in databases.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("primary index,secondary index,clustered,non clustered,b tree,hash").published(true).build());

        questionRepository.save(Question.builder().text("What is normalization? Explain 1NF, 2NF, 3NF and BCNF.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("redundancy,dependency,normal form,functional dependency,prime attribute").published(true).build());

        questionRepository.save(Question.builder().text("Explain the OSI model layers and their functions.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("physical,data link,network,transport,session,presentation,application,layer,tcp,udp,ip").published(true).build());

        questionRepository.save(Question.builder().text("What is the difference between TCP and UDP?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.EASY)
                .expectedKeywords("connection oriented,connectionless,reliable,unreliable,three way handshake,packet ordering").published(true).build());

        questionRepository.save(Question.builder().text("Explain process vs thread. What is multithreading?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("process,thread,heap,stack,context switch,concurrency,parallelism").published(true).build());

        questionRepository.save(Question.builder().text("What is deadlock? Explain the four necessary conditions for deadlock.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("mutual exclusion,hold and wait,no preemption,circular wait,resource").published(true).build());

        questionRepository.save(Question.builder().text("Explain different scheduling algorithms in OS.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("fcfs,sjf,round robin,priority,preemptive,non preemptive,throughput").published(true).build());

        questionRepository.save(Question.builder().text("What is virtual memory? Explain paging and segmentation.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("ram,page table,page fault,segment,memory management unit,fragmentation").published(true).build());

        questionRepository.save(Question.builder().text("Design a URL shortening service like TinyURL.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.HARD)
                .expectedKeywords("hash function,base62,database,cache,short code,collision,scaling").published(true).build());

        questionRepository.save(Question.builder().text("How would you design a distributed caching system?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.HARD)
                .expectedKeywords("cache eviction,lru,consistent hashing,replication,invalidation,latency").published(true).build());

        questionRepository.save(Question.builder().text("Design a scalable chat application like WhatsApp.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.HARD)
                .expectedKeywords("websocket,message queue,pub sub,database,message id,read receipt").published(true).build());

        questionRepository.save(Question.builder().text("Explain CAP theorem and its tradeoffs.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.HARD)
                .expectedKeywords("consistency,availability,partition tolerance,network partition,tradeoff").published(true).build());

        questionRepository.save(Question.builder().text("Design a rate limiter for an API. What algorithms would you use?")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.HARD)
                .expectedKeywords("token bucket,leaky bucket,sliding window,fixed window counter,rate limit").published(true).build());

        questionRepository.save(Question.builder().text("What are microservices? Compare with monolithic architecture.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("monolith,micro services,independently deployable,service registry,api gateway,inter service communication").published(true).build());

        questionRepository.save(Question.builder().text("Explain SOLID principles with examples.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("single responsibility,open closed,liskov substitution,interface segregation,dependency inversion").published(true).build());

        questionRepository.save(Question.builder().text("What is dependency injection? Explain types and benefits.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.MEDIUM)
                .expectedKeywords("constructor injection,setter injection,interface injection,loose coupling,testability,ioc").published(true).build());

        questionRepository.save(Question.builder().text("Explain the difference between authorization and authentication.")
                .category(QuestionCategory.INTERVIEW).difficulty(Difficulty.EASY)
                .expectedKeywords("who are you,what can you do,jwt,token,oauth,password,role").published(true).build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Second Largest Element").topic("Arrays").difficulty(Difficulty.EASY)
                .statement("Given an integer array, return the second largest distinct element. Return -1 if it does not exist.")
                .methodName("secondLargest").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[12, 35, 1, 10, 34, 1]").sampleOutput("34").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Move Zeroes to End").topic("Arrays").difficulty(Difficulty.EASY)
                .statement("Move all zeroes to the end of the array while preserving the relative order of non-zero elements.")
                .methodName("moveZeroes").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[0,1,0,3,12]").sampleOutput("[1,3,12,0,0]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Search Insert Position").topic("Binary Search").difficulty(Difficulty.EASY)
                .statement("Given a sorted array and a target value, return the index if found or the position where it should be inserted.")
                .methodName("searchInsert").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "sorted array"), new ParameterSpec("target", "int", "value to insert")))
                .sampleInput("nums=[1,3,5,6], target=5").sampleOutput("2").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: First and Last Occurrence").topic("Binary Search").difficulty(Difficulty.MEDIUM)
                .statement("Find the first and last position of a target in a sorted array. Return [-1,-1] if the target is absent.")
                .methodName("searchRange").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "sorted array"), new ParameterSpec("target", "int", "value to find")))
                .sampleInput("nums=[5,7,7,8,8,10], target=8").sampleOutput("[3,4]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Sort Characters by Frequency").topic("Strings").difficulty(Difficulty.MEDIUM)
                .statement("Given a string, return characters sorted by decreasing frequency. If multiple answers are possible, return any valid one.")
                .methodName("frequencySort").returnType("string")
                .parameters(List.of(new ParameterSpec("s", "string", "input string")))
                .sampleInput("\"tree\"").sampleOutput("\"eetr\"").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Check Palindrome Linked List").topic("LinkedList").difficulty(Difficulty.MEDIUM)
                .statement("Return true if the values in a singly linked list form a palindrome.")
                .methodName("isPalindrome").returnType("boolean")
                .parameters(List.of(new ParameterSpec("head", "listnode", "head of the list")))
                .sampleInput("[1,2,2,1]").sampleOutput("true").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Generate Parentheses").topic("Recursion").difficulty(Difficulty.MEDIUM)
                .statement("Generate all combinations of well-formed parentheses for n pairs.")
                .methodName("generateParenthesis").returnType("list<string>")
                .parameters(List.of(new ParameterSpec("n", "int", "number of pairs")))
                .sampleInput("n=3").sampleOutput("[\"((()))\",\"(()())\",\"(())()\",\"()(())\",\"()()()\"]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Largest Rectangle in Histogram").topic("Stack").difficulty(Difficulty.HARD)
                .statement("Given bar heights in a histogram, return the area of the largest rectangle.")
                .methodName("largestRectangleArea").returnType("int")
                .parameters(List.of(new ParameterSpec("heights", "int[]", "bar heights")))
                .sampleInput("[2,1,5,6,2,3]").sampleOutput("10").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Longest Repeating Character Replacement").topic("Sliding Window").difficulty(Difficulty.MEDIUM)
                .statement("Given a string and k replacements, return the length of the longest substring containing the same letter after at most k changes.")
                .methodName("characterReplacement").returnType("int")
                .parameters(List.of(new ParameterSpec("s", "string", "input string"), new ParameterSpec("k", "int", "max replacements")))
                .sampleInput("s=\"AABABBA\", k=1").sampleOutput("4").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Kth Largest Element").topic("Heaps").difficulty(Difficulty.MEDIUM)
                .statement("Return the kth largest element in an unsorted array.")
                .methodName("findKthLargest").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers"), new ParameterSpec("k", "int", "k-th position")))
                .sampleInput("nums=[3,2,1,5,6,4], k=2").sampleOutput("5").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Minimum Platforms").topic("Greedy").difficulty(Difficulty.MEDIUM)
                .statement("Given arrival and departure times of trains, find the minimum number of platforms required so no train waits.")
                .methodName("minPlatforms").returnType("int")
                .parameters(List.of(new ParameterSpec("arrival", "int[]", "arrival times"), new ParameterSpec("departure", "int[]", "departure times")))
                .sampleInput("arr=[900,940,950,1100,1500,1800], dep=[910,1200,1120,1130,1900,2000]").sampleOutput("3").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Boundary Traversal of Binary Tree").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Return the boundary traversal of a binary tree in anti-clockwise direction excluding duplicate nodes.")
                .methodName("boundaryTraversal").returnType("list<int>")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the tree")))
                .sampleInput("root=[1,2,3,4,5,6,7]").sampleOutput("[1,2,4,5,6,7,3]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Kth Smallest in BST").topic("Trees").difficulty(Difficulty.MEDIUM)
                .statement("Given a binary search tree and k, return the kth smallest node value.")
                .methodName("kthSmallest").returnType("int")
                .parameters(List.of(new ParameterSpec("root", "treenode", "root of the BST"), new ParameterSpec("k", "int", "k-th position")))
                .sampleInput("root=[3,1,4,null,2], k=1").sampleOutput("1").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Topological Sort").topic("Graphs").difficulty(Difficulty.MEDIUM)
                .statement("Given a directed acyclic graph, return one valid topological ordering of its vertices.")
                .methodName("topoSort").returnType("int[]")
                .parameters(List.of(new ParameterSpec("numNodes", "int", "number of nodes"), new ParameterSpec("edges", "int[][]", "directed edges")))
                .sampleInput("V=4, edges=[[3,0],[1,0],[2,0]]").sampleOutput("[1,2,3,0]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Shortest Path in Binary Matrix").topic("Graphs").difficulty(Difficulty.MEDIUM)
                .statement("Return the length of the shortest clear path from top-left to bottom-right in an n x n binary matrix.")
                .methodName("shortestPathBinaryMatrix").returnType("int")
                .parameters(List.of(new ParameterSpec("grid", "int[][]", "binary grid")))
                .sampleInput("grid=[[0,1],[1,0]]").sampleOutput("2").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Longest Increasing Subsequence").topic("DP").difficulty(Difficulty.MEDIUM)
                .statement("Return the length of the longest strictly increasing subsequence.")
                .methodName("lengthOfLIS").returnType("int")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers")))
                .sampleInput("[10,9,2,5,3,7,101,18]").sampleOutput("4").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Striver A2Z: Implement Trie").topic("Tries").difficulty(Difficulty.MEDIUM)
                .statement("Implement insert, search and startsWith operations for a prefix tree.")
                .methodName("trieOperations").returnType("list<int>")
                .parameters(List.of(new ParameterSpec("operations", "string[]", "sequence of insert/search/startsWith ops"), new ParameterSpec("words", "string[]", "word argument for each op")))
                .sampleInput("insert apple, search apple, search app, startsWith app").sampleOutput("true,false,true").build());

        // Section 4 (question bank coverage): the seeded set above had no Queue- or Segment-Tree-
        // tagged problem at all, so those two categories could never show a correct signature no
        // matter what the generator did - added here rather than silently leaving them uncovered.
        codingProblemRepository.save(CodingProblem.builder()
                .title("Sliding Window Maximum").topic("Queue").difficulty(Difficulty.MEDIUM)
                .statement("Given an array and a sliding window of size k moving from left to right, return the maximum in each window.")
                .methodName("maxSlidingWindow").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers"), new ParameterSpec("k", "int", "window size")))
                .sampleInput("[1,3,-1,-3,5,3,6,7], k=3").sampleOutput("[3,3,5,5,6,7]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Range Minimum Query").topic("Segment Tree").difficulty(Difficulty.MEDIUM)
                .statement("Given an array and a list of [l, r] range queries, return the minimum value in each range (inclusive).")
                .methodName("rangeMinimumQuery").returnType("int[]")
                .parameters(List.of(new ParameterSpec("nums", "int[]", "array of integers"), new ParameterSpec("queries", "int[][]", "array of [l, r] ranges")))
                .sampleInput("nums=[2,4,1,7,3,9,5], queries=[[0,2],[3,5],[1,6]]").sampleOutput("[1,3,1]").build());

        // Section 9: domain-specific mid-interview coding challenge needs a problem for the Data
        // and Machine Learning tracks, not just SDE/DSA - these reuse the exact same execution
        // engine (Section 4's per-question signature infra) rather than a separate SQL sandbox,
        // which doesn't exist in this codebase and would be a much larger, riskier addition than
        // an accurately-scoped Python/Java-gradable data/ML problem.
        codingProblemRepository.save(CodingProblem.builder()
                .title("Revenue by Category").topic("Data Analysis").difficulty(Difficulty.MEDIUM)
                .statement("Given parallel arrays of category names and revenue amounts for a set of orders, return the total revenue for each distinct category, in the order each category first appears.")
                .methodName("revenueByCategory").returnType("list<int>")
                .parameters(List.of(new ParameterSpec("categories", "string[]", "category name per order"), new ParameterSpec("revenue", "int[]", "revenue amount per order")))
                .sampleInput("categories=[Electronics,Grocery,Electronics,Grocery,Toys], revenue=[500,120,300,80,60]")
                .sampleOutput("[800,200,60]").build());

        codingProblemRepository.save(CodingProblem.builder()
                .title("Linear Regression Slope").topic("Applied ML").difficulty(Difficulty.MEDIUM)
                .statement("Given arrays of x and y values, compute the slope of the least-squares linear regression line fitted to the points, rounded to 2 decimal places.")
                .methodName("computeSlope").returnType("double")
                .parameters(List.of(new ParameterSpec("x", "int[]", "independent variable values"), new ParameterSpec("y", "int[]", "dependent variable values")))
                .sampleInput("x=[1,2,3,4,5], y=[2,4,6,8,10]")
                .sampleOutput("2.00").build());

        System.out.println("=================================================================");
        // Aptitude/quant/reasoning question bank — loaded from a structured JSON file (not
        // hardcoded) so it can scale to any number of questions. See AptitudeQuestionSeedLoader
        // and resources/seed-data/aptitude-questions.json, or bulk-upload more via
        // POST /api/admin/aptitude-questions/bulk-upload.
        aptitudeQuestionSeedLoader.loadSeedQuestions().stream()
                .map(aptitudeQuestionSeedLoader::toEntity)
                .forEach(aptitudeQuestionRepository::save);

        System.out.println(" Seed data loaded.");
        System.out.println(" Admin login:   admin@placement.io / Admin@123");
        System.out.println(" Student login: student@placement.io / Student@123");
        System.out.println("=================================================================");
        } // end of the fresh-database-only seeding above (userRepository.count() == 0)

        // Section 5 (Company Vault): deliberately its own condition, checked every boot,
        // independent of the user-seeding block above - that's what makes this run even against
        // an already-seeded database. Real data (real company tags, real LeetCode/GFG links) is
        // what backs Company Vault; without this it silently stays empty until the weekly
        // @Scheduled sync (Sunday 3am) or a manual POST /api/admin/questionbank/sync.
        if (canonicalQuestionRepository.count() == 0) {
            System.out.println(" Running initial question-bank sync (LeetCode/GFG/HackerRank/TUF)...");
            questionSyncService.syncAll();
        }
    }
}
