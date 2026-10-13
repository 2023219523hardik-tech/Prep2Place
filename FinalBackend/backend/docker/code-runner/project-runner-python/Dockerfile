FROM python:3.12-slim

# Deliberately no `pip install`: containers run with --network=none (see
# CodingLabSeedLoader's class javadoc), so any package fetch would just fail.
# Attempts only ever run bare `python3 public_test.py` / `python3
# hidden_test.py` (see ProjectCodeRunnerService /
# CodingLabSeedLoader.pythonRunCommand) against vanilla stdlib-only code -
# the interpreter alone covers it.

RUN useradd --create-home --uid 10001 runner

WORKDIR /workspace

USER runner
