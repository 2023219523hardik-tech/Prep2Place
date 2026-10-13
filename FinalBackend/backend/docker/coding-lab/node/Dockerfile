# Build:  docker build -t prep2place-lab-node:1 backend/docker/coding-lab/node
FROM node:22-bookworm-slim
WORKDIR /opt/p2p
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY p2p-run.sh build.mjs setup-dom.cjs /opt/p2p/
RUN sed -i 's/\r$//' /opt/p2p/p2p-run.sh && chmod 755 /opt/p2p/p2p-run.sh
RUN useradd --create-home --uid 10001 runner
WORKDIR /workspace
USER runner
ENTRYPOINT ["/opt/p2p/p2p-run.sh"]
