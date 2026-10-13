package com.placement.config;

import com.placement.entity.JobRole;
import com.placement.repository.JobRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seeds the expanded job-role catalogue.
 *
 * Idempotent and non-destructive: roles are matched on the unique title, and an existing row is
 * only *topped up* - the new columns are filled in if they are still null, but a title, description
 * or skill list an admin has already edited is never overwritten.
 */
@Component
@RequiredArgsConstructor
@Order(20)
@Slf4j
public class JobRoleCatalogSeedLoader implements ApplicationRunner {

    private final JobRoleRepository jobRoleRepository;

    private record RoleSeed(String title, String department, String description,
                            String requiredSkills, String preferredSkills,
                            String experienceLevel, int minReadinessScore) {}

    private static final List<RoleSeed> ROLES = List.of(
            new RoleSeed("Software Development Engineer", "Engineering",
                    "Designs, builds and ships production software across the stack, with ownership of correctness, performance and on-call health.",
                    "DSA,System Design,Java,Git,Problem Solving", "Distributed Systems,Cloud,Kubernetes", "ENTRY", 75),
            new RoleSeed("Associate Software Engineer", "Engineering",
                    "Entry-level engineering role focused on implementing well-scoped features under guidance and learning the codebase.",
                    "DSA,OOPS,SQL,Git", "Spring Boot,REST API,Testing", "FRESHER", 60),
            new RoleSeed("Backend Developer", "Engineering",
                    "Builds server-side services, APIs and data access layers, and owns their reliability and latency.",
                    "Java,Spring Boot,SQL,REST API,DSA", "Microservices,Docker,Kafka,Redis", "ENTRY", 70),
            new RoleSeed("Frontend Developer", "Engineering",
                    "Builds user-facing interfaces with an eye on accessibility, responsiveness and perceived performance.",
                    "JavaScript,React,HTML,CSS,REST API", "TypeScript,Next.js,Testing,Web Performance", "ENTRY", 65),
            new RoleSeed("Full Stack Developer", "Engineering",
                    "Works across frontend and backend, from database schema through to the rendered screen.",
                    "JavaScript,React,Node.js,SQL,REST API", "TypeScript,Docker,Cloud,System Design", "MID", 72),
            new RoleSeed("Java Developer", "Engineering",
                    "Builds and maintains JVM applications, with emphasis on the collections framework, concurrency and the memory model.",
                    "Java,OOPS,Collections,Multithreading,SQL", "Spring,JPA,Maven,JUnit", "ENTRY", 68),
            new RoleSeed("Spring Boot Developer", "Engineering",
                    "Specialises in Spring Boot services: dependency injection, data access, security and observability.",
                    "Java,Spring Boot,REST API,JPA,SQL", "Spring Security,Microservices,Kafka,Docker", "MID", 72),
            new RoleSeed("Python Developer", "Engineering",
                    "Builds Python services, automation and data tooling.",
                    "Python,OOPS,SQL,REST API", "Django,FastAPI,Pandas,Testing", "ENTRY", 65),
            new RoleSeed("Data Analyst", "Data",
                    "Turns raw data into decisions through querying, analysis and clear reporting.",
                    "SQL,Excel,Statistics,Data Visualization", "Python,Pandas,Power BI,Tableau", "FRESHER", 60),
            new RoleSeed("Data Scientist", "Data",
                    "Frames business problems as statistical or ML problems and validates the results honestly.",
                    "Python,Statistics,Machine Learning,SQL,Pandas", "Deep Learning,Experiment Design,MLOps", "MID", 78),
            new RoleSeed("Machine Learning Engineer", "Data",
                    "Takes models from notebook to production and keeps them healthy there.",
                    "Python,Machine Learning,DSA,SQL", "TensorFlow,PyTorch,MLOps,Docker,Cloud", "MID", 78),
            new RoleSeed("AI Engineer", "Data",
                    "Builds applications on top of AI models, including evaluation and guardrails.",
                    "Python,Machine Learning,REST API,System Design", "Deep Learning,Vector Databases,Prompt Engineering", "MID", 76),
            new RoleSeed("GenAI Engineer", "Data",
                    "Builds generative-AI features: retrieval pipelines, prompt orchestration and evaluation harnesses.",
                    "Python,Generative AI,REST API,Vector Databases", "RAG,LangChain,Embeddings,Evaluation", "MID", 76),
            new RoleSeed("DevOps Engineer", "Infrastructure",
                    "Owns build, deployment and runtime automation, and the feedback loops around them.",
                    "Linux,Docker,CI/CD,Git,Cloud", "Kubernetes,Terraform,Monitoring,Scripting", "MID", 72),
            new RoleSeed("Cloud Engineer", "Infrastructure",
                    "Designs and operates cloud infrastructure with cost, security and resilience in view.",
                    "Cloud Computing,Linux,Networking,IaC", "AWS,Azure,GCP,Kubernetes,Terraform", "MID", 72),
            new RoleSeed("QA Engineer", "Quality",
                    "Designs test strategy and catches defects before users do.",
                    "Manual Testing,Test Design,SQL,Bug Reporting", "Selenium,API Testing,Performance Testing", "FRESHER", 58),
            new RoleSeed("Automation Test Engineer", "Quality",
                    "Builds and maintains automated test suites and keeps them trustworthy.",
                    "Java,Selenium,Test Automation,CI/CD", "TestNG,REST Assured,Cypress,Docker", "ENTRY", 66),
            new RoleSeed("Database Engineer", "Data",
                    "Owns schema design, query performance, backups and recovery.",
                    "SQL,DBMS,Indexing,Query Optimization", "PostgreSQL,Replication,Partitioning,NoSQL", "MID", 72),
            new RoleSeed("SQL Developer", "Data",
                    "Writes and tunes the queries, views and procedures that applications depend on.",
                    "SQL,DBMS,Joins,Stored Procedures", "Window Functions,Performance Tuning,ETL", "FRESHER", 60),
            new RoleSeed("Mobile Developer", "Engineering",
                    "Builds mobile applications and handles the constraints of the device and the store.",
                    "OOPS,REST API,UI Design,Git", "Kotlin,Swift,React Native,Offline Sync", "ENTRY", 66),
            new RoleSeed("Android Developer", "Engineering",
                    "Builds native Android applications.",
                    "Java,Kotlin,Android SDK,REST API", "Jetpack Compose,Room,Coroutines", "ENTRY", 66),
            new RoleSeed("iOS Developer", "Engineering",
                    "Builds native iOS applications.",
                    "Swift,iOS SDK,REST API,OOPS", "SwiftUI,Combine,Core Data", "ENTRY", 66),
            new RoleSeed("SRE", "Infrastructure",
                    "Keeps production reliable through SLOs, automation and blameless incident response.",
                    "Linux,Networking,Monitoring,Scripting,Cloud", "Kubernetes,Terraform,Incident Response,Distributed Systems", "SENIOR", 80),
            new RoleSeed("Cybersecurity Analyst", "Security",
                    "Monitors, investigates and hardens systems against attack.",
                    "Networking,Operating Systems,Security Fundamentals,Linux", "SIEM,Threat Modeling,Incident Response,Cryptography", "ENTRY", 70),
            new RoleSeed("Business Analyst", "Business",
                    "Bridges business need and technical delivery through requirements and analysis.",
                    "Requirement Analysis,SQL,Communication,Documentation", "Excel,Power BI,Stakeholder Management,Agile", "FRESHER", 58),
            new RoleSeed("Product Analyst", "Business",
                    "Measures product behaviour and turns it into product decisions.",
                    "SQL,Analytics,Statistics,Communication", "A/B Testing,Product Metrics,Dashboards", "FRESHER", 60),
            new RoleSeed("Associate Solution Engineer", "Customer Engineering",
                    "Pairs technical depth with customer-facing communication during evaluation and onboarding.",
                    "Programming Fundamentals,REST API,SQL,Communication", "Cloud,Presentation Skills,Troubleshooting", "FRESHER", 62),
            new RoleSeed("NOC Engineer", "Infrastructure",
                    "Monitors network and system health and drives first-line incident response.",
                    "Networking,Linux,Monitoring,Troubleshooting", "Ticketing Systems,Scripting,Escalation Management", "FRESHER", 55)
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int created = 0, enriched = 0;
        for (RoleSeed seed : ROLES) {
            JobRole existing = jobRoleRepository.findAll().stream()
                    .filter(r -> seed.title().equalsIgnoreCase(r.getTitle()))
                    .findFirst().orElse(null);

            if (existing == null) {
                jobRoleRepository.save(JobRole.builder()
                        .title(seed.title())
                        .domain(seed.department())
                        .department(seed.department())
                        .description(seed.description())
                        .requiredSkills(seed.requiredSkills())
                        .preferredSkills(seed.preferredSkills())
                        .experienceLevel(seed.experienceLevel())
                        .minReadinessScore(seed.minReadinessScore())
                        .active(true)
                        .build());
                created++;
            } else if (existing.getDepartment() == null || existing.getExperienceLevel() == null
                    || existing.getMinReadinessScore() == null) {
                // Top up only the columns V5 introduced; anything already set stays as the admin left it.
                if (existing.getDepartment() == null)
                    existing.setDepartment(existing.getDomain() != null ? existing.getDomain() : seed.department());
                if (existing.getPreferredSkills() == null) existing.setPreferredSkills(seed.preferredSkills());
                if (existing.getExperienceLevel() == null) existing.setExperienceLevel(seed.experienceLevel());
                if (existing.getMinReadinessScore() == null) existing.setMinReadinessScore(seed.minReadinessScore());
                jobRoleRepository.save(existing);
                enriched++;
            }
        }
        log.info("Job role catalogue: {} created, {} enriched", created, enriched);
    }
}
