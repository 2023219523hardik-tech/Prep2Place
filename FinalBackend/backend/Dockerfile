# ============================================================
# Stage 1: Build Spring Boot JAR with Maven + JDK 21
# ============================================================
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

COPY FinalBackend/backend/pom.xml ./pom.xml
RUN mvn -B -ntp dependency:go-offline

COPY FinalBackend/backend/src ./src
RUN mvn -B -ntp clean package -DskipTests -Djacoco.skip=true

# ============================================================
# Stage 2: Production Runtime Image
# ============================================================
FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app

RUN apk add --no-cache curl tzdata python3 nodejs \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup

ENV TZ=UTC

COPY --from=builder /build/target/placement-platform-1.0.0.jar /app/app.jar

COPY company-wise-question-sheets /data/company-wise-question-sheets
COPY dsa-questions.json /data/dsa-questions.json
COPY FinalBackend/sql-questions.json /data/sql-questions.json
COPY FinalBackend/dataframe-questions.json /data/dataframe-questions.json
COPY FinalBackend/sql-questions.json /app/sql-questions.json
COPY FinalBackend/dataframe-questions.json /app/dataframe-questions.json

RUN chown -R appuser:appgroup /app /data

USER appuser

ENV COMPANY_SHEETS_PATH=file:/data/company-wise-question-sheets/
ENV LEETCODE_SEED_JSON_PATH=file:/data/dsa-questions.json
ENV APP_SEED_SQL_PATH=/data/sql-questions.json
ENV APP_SEED_DATAFRAME_PATH=/data/dataframe-questions.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -sf http://localhost:${PORT:-8080}/api/auth/public || curl -sf http://localhost:${PORT:-8080}/actuator/health || exit 1

ENV JAVA_OPTS="-XX:MaxRAMPercentage=70.0 -XX:MaxMetaspaceSize=160m -XX:+UseSerialGC -Xss512k -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar /app/app.jar"]
