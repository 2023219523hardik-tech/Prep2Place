# Build:  docker build -t prep2place-lab-python:1 backend/docker/coding-lab/python
FROM python:3.12-slim
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt
RUN useradd --create-home --uid 10001 runner
COPY p2p-run.sh /opt/p2p/p2p-run.sh
RUN sed -i 's/\r$//' /opt/p2p/p2p-run.sh && chmod 755 /opt/p2p/p2p-run.sh
WORKDIR /workspace
USER runner
ENTRYPOINT ["/opt/p2p/p2p-run.sh"]
