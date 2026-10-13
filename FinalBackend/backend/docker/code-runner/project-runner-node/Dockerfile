FROM node:20-jammy

# Deliberately no `npm install`: containers run with --network=none (see
# CodingLabSeedLoader's class javadoc), so any package fetch would just fail.
# Attempts only ever run bare `node publicTest.js` / `node hiddenTest.js`
# (see ProjectCodeRunnerService / CodingLabSeedLoader.nodeRunCommand) against
# vanilla JS with no external dependencies - the node binary alone covers it.

RUN userdel -r node 2>/dev/null || true \
    && useradd --create-home --uid 10001 runner

WORKDIR /workspace

USER runner
