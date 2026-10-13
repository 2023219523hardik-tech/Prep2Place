#!/bin/sh
# Builds the three Coding Lab sandbox images. Run from the repository root:  sh backend/docker/coding-lab/build-images.sh
set -e
D="$(dirname "$0")"
docker build -t prep2place-lab-java:1   "$D/java"
docker build -t prep2place-lab-node:1   "$D/node"
docker build -t prep2place-lab-python:1 "$D/python"
echo "Done. Verify with:  docker images | grep prep2place-lab"
