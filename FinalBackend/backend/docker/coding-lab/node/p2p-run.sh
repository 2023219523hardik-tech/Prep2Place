#!/bin/sh
# Prep2Place Coding Lab runner - Node (node:test), incl. React + jsdom for FRONTEND. Same contract as java/p2p-run.sh.
W="${P2P_WORKSPACE:-/workspace}"; HOME_DIR="${P2P_HOME:-/opt/p2p}"; OUT="${P2P_OUT:-/tmp/p2p-out}"
SUITE="${P2P_SUITE:-public}"; BT="${P2P_BUILD_TIMEOUT:-30}"; RT="${P2P_TIMEOUT:-60}"
cd "$W" || exit 97
mkdir -p .p2p "$OUT/$SUITE"; : > .p2p/build.log
# Testing Library colours its DOM dumps with ANSI escapes by default; those bytes are illegal in XML and would make
# the whole JUnit report unreadable on the first failing assertion. Keep all tool output plain.
export NODE_PATH="$HOME_DIR/node_modules" HOME="${HOME:-/tmp}" NODE_ENV=test COLORS=false NO_COLOR=1 FORCE_COLOR=0

if [ ! -d "tests/$SUITE" ]; then
  echo "No tests under tests/$SUITE/" > ".p2p/run-$SUITE.log"
  echo '<?xml version="1.0" encoding="UTF-8"?><testsuites><testsuite name="empty" tests="0" failures="0" errors="0" skipped="0"/></testsuites>' > ".p2p/report-$SUITE.xml"
  echo 0 > .p2p/build.status
  exit 0
fi

# Build: bundle each test file together with the student's relative imports (JSX / TS handled by esbuild).
# npm packages stay external and resolve from the image's pre-installed node_modules via NODE_PATH.
timeout -k 2 "$BT" node "$HOME_DIR/build.mjs" "tests/$SUITE" "$OUT/$SUITE" > .p2p/build.log 2>&1
BUILD=$?
echo "$BUILD" > .p2p/build.status
[ "$BUILD" -eq 0 ] || exit 0

REQ=""; [ "${P2P_DOM:-0}" = "1" ] && REQ="--require $HOME_DIR/setup-dom.cjs"
# shellcheck disable=SC2086
timeout -k 2 "$RT" node $REQ --test --test-timeout=$((RT * 500)) \
  --test-reporter=junit --test-reporter-destination=".p2p/report-$SUITE.xml" \
  --test-reporter=spec --test-reporter-destination=stdout \
  "$OUT/$SUITE"/*.cjs > ".p2p/run-$SUITE.log" 2>&1
RC=$?
{ [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; } && touch ".p2p/timeout-$SUITE"
exit 0
