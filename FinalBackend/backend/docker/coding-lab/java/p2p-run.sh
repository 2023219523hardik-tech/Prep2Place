#!/bin/sh
# Prep2Place Coding Lab runner - Java / JUnit 5.
#
# Contract (identical for every runtime): the backend bind-mounts the project at /workspace and sets
#   P2P_SUITE            "public" | "hidden"   (one suite per container - see CodingLabService#submit)
#   P2P_BUILD_TIMEOUT    seconds allowed for compilation
#   P2P_TIMEOUT          seconds allowed for the test run
# This script ALWAYS exits 0 after writing its findings to /workspace/.p2p/ :
#   build.status (0 = compiled)   build.log   report-<suite>.xml (JUnit XML)
#   run-<suite>.log (raw stdout/stderr)   timeout-<suite> (marker file, only if the run was killed)
# The backend - not this script's exit code - decides pass/fail.
W="${P2P_WORKSPACE:-/workspace}"; LIB="${P2P_LIB:-/opt/p2p/lib}"; OUT="${P2P_OUT:-/tmp/p2p-out}"
SUITE="${P2P_SUITE:-public}"; BT="${P2P_BUILD_TIMEOUT:-60}"; RT="${P2P_TIMEOUT:-60}"
cd "$W" || exit 97
mkdir -p .p2p "$OUT"; : > .p2p/build.log

find . -name '*.java' -not -path './.p2p/*' > "$OUT/sources.txt"
if [ ! -s "$OUT/sources.txt" ]; then
  echo "No .java source files found in the project." > .p2p/build.log; echo 1 > .p2p/build.status; exit 0
fi

timeout -k 2 "$BT" javac -J-XX:MaxRAMPercentage=70 -J-XX:+UseSerialGC -encoding UTF-8 -Xlint:none \
  -cp "$LIB/*" -d "$OUT" @"$OUT/sources.txt" > .p2p/build.log 2>&1
BUILD=$?
echo "$BUILD" > .p2p/build.status
[ "$BUILD" -eq 0 ] || exit 0

# ship non-java resources (application.properties, json fixtures...) next to the compiled classes
find . -path './.p2p' -prune -o -type f -path '*/resources/*' -print 2>/dev/null | while read -r f; do
  rel="${f#*/resources/}"; mkdir -p "$OUT/$(dirname "$rel")"; cp "$f" "$OUT/$rel"
done

# Every *.java under tests/<suite>/ is a test class; derive its FQCN from the package declaration.
SELECT=""
for f in $(find "tests/$SUITE" -name '*.java' 2>/dev/null | sort); do
  pkg=$(sed -n 's/^[[:space:]]*package[[:space:]]\{1,\}\([A-Za-z0-9_.]\{1,\}\)[[:space:]]*;.*/\1/p' "$f" | head -1)
  base=$(basename "$f" .java)
  SELECT="$SELECT --select-class ${pkg:+$pkg.}$base"
done
if [ -z "$SELECT" ]; then echo "No test classes under tests/$SUITE/" > ".p2p/run-$SUITE.log"; exit 0; fi

# shellcheck disable=SC2086
timeout -k 2 "$RT" java -XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xshare:auto -cp "$OUT:$LIB/*" \
  org.junit.platform.console.ConsoleLauncher execute $SELECT \
  --reports-dir="$W/.p2p/junit-$SUITE" --disable-banner --disable-ansi-colors --details=tree \
  > ".p2p/run-$SUITE.log" 2>&1
RC=$?
{ [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; } && touch ".p2p/timeout-$SUITE"
# The console launcher also writes an (empty) TEST-junit-vintage.xml - we only grade JUnit Jupiter tests.
[ -f ".p2p/junit-$SUITE/TEST-junit-jupiter.xml" ] && cp ".p2p/junit-$SUITE/TEST-junit-jupiter.xml" ".p2p/report-$SUITE.xml"
exit 0
