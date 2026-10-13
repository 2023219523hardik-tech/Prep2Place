FROM eclipse-temurin:21-jdk-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       g++ \
       nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 runner

WORKDIR /workspace

USER runner