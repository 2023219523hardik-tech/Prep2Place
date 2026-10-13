FROM eclipse-temurin:21-jdk-jammy

# Deliberately no Maven/Gradle: containers run with --network=none (see
# CodingLabSeedLoader's class javadoc), so a build tool that wants to resolve
# dependencies from the internet would just fail. Attempts only ever run
# `javac *.java && java -cp . <Class>` (see ProjectCodeRunnerService /
# CodingLabSeedLoader.javacRunCommand) - the JDK alone is enough for that.

RUN useradd --create-home --uid 10001 runner

WORKDIR /workspace

USER runner
