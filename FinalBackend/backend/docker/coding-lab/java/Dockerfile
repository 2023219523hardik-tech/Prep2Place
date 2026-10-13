# Build:  docker build -t prep2place-lab-java:1 backend/docker/coding-lab/java
FROM maven:3.9-eclipse-temurin-21 AS deps
COPY pom.xml /build/pom.xml
RUN mvn -q -B -f /build/pom.xml dependency:copy-dependencies -DoutputDirectory=/libs

FROM eclipse-temurin:21-jdk-jammy
RUN useradd --create-home --uid 10001 runner
COPY --from=deps /libs /opt/p2p/lib
COPY p2p-run.sh /opt/p2p/p2p-run.sh
# tolerate CRLF checkouts on Windows
RUN sed -i 's/\r$//' /opt/p2p/p2p-run.sh && chmod 755 /opt/p2p/p2p-run.sh
WORKDIR /workspace
USER runner
ENTRYPOINT ["/opt/p2p/p2p-run.sh"]
