#!/bin/sh
# Prep2Place Coding Lab runner - Python / pytest. Same contract as java/p2p-run.sh.
W="${P2P_WORKSPACE:-/workspace}"; SUITE="${P2P_SUITE:-public}"; BT="${P2P_BUILD_TIMEOUT:-30}"; RT="${P2P_TIMEOUT:-60}"
cd "$W" || exit 97
mkdir -p .p2p; : > .p2p/build.log
export PYTHONPATH="$W:$W/src:${PYTHONPATH:-}" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME="${HOME:-/tmp}"

# "Build" step: compile-check every student file so a syntax error is reported as a BUILD error with a
# real line number, instead of surfacing as a pile of confusing pytest collection errors.
timeout -k 2 "$BT" python3 - > .p2p/build.log 2>&1 <<'PY'
import os, sys
bad = 0
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in (".p2p", "tests", "__pycache__", ".git")]
    for f in files:
        if f.endswith(".py"):
            p = os.path.join(root, f)
            try:
                compile(open(p, encoding="utf-8").read(), p, "exec")
            except SyntaxError as e:
                bad += 1
                print(f"{p}:{e.lineno}: {e.__class__.__name__}: {e.msg}")
                if e.text:
                    print("    " + e.text.strip())
sys.exit(1 if bad else 0)
PY
BUILD=$?
echo "$BUILD" > .p2p/build.status
[ "$BUILD" -eq 0 ] || exit 0

if [ ! -d "tests/$SUITE" ]; then echo "No tests under tests/$SUITE/" > ".p2p/run-$SUITE.log"; exit 0; fi
timeout -k 2 "$RT" python3 -m pytest "tests/$SUITE" -q --tb=short -p no:cacheprovider \
  -o junit_family=xunit2 -o junit_logging=no --junitxml=".p2p/report-$SUITE.xml" > ".p2p/run-$SUITE.log" 2>&1
RC=$?
{ [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; } && touch ".p2p/timeout-$SUITE"
exit 0
