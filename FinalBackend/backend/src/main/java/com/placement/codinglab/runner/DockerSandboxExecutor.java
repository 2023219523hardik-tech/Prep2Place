package com.placement.codinglab.runner;

import com.placement.codinglab.entity.CodingRuntime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Runs a project inside a disposable, locked-down Docker container built from one of the three images in
 * {@code backend/docker/coding-lab/}. The container's entrypoint is the runtime's {@code p2p-run.sh}, which
 * writes its findings to {@code /workspace/.p2p/}; this class never interprets shell exit codes as test results.
 *
 * <p>Hardening: read-only root FS, no network, no capabilities, no-new-privileges, cpu/memory/pids caps,
 * memory-swap == memory, non-root user, tiny writable tmpfs, and a host-side watchdog that force-removes the
 * container if the in-container timeouts somehow fail. Concurrency is bounded by a semaphore so a burst of
 * submissions queues (and eventually answers "busy") instead of exhausting the host.
 */
@Component
@Slf4j
public class DockerSandboxExecutor implements SandboxExecutor {

    private static final String USER_UNAVAILABLE = "The code runner is unavailable right now. Please try again shortly or contact your administrator.";
    private static final int MAX_LOG_CHARS = 16_000;
    private static final int MAX_REPORT_CHARS = 2_000_000;

    private final String provider;
    private final String dockerBinary;
    private final Map<CodingRuntime, String> images = new EnumMap<>(CodingRuntime.class);
    private final boolean networkDisabled;
    private final int maxOutputBytes;
    private final int buildTimeoutSeconds;
    private final int queueWaitSeconds;
    private final Semaphore slots;

    private volatile RunnerStatus cachedStatus;
    private volatile long cachedAt;

    public DockerSandboxExecutor(
            @Value("${app.coding-lab.runner.provider:docker}") String provider,
            @Value("${app.coding-lab.runner.docker.binary:docker}") String dockerBinary,
            @Value("${app.coding-lab.runner.image.java:prep2place-lab-java:1}") String javaImage,
            @Value("${app.coding-lab.runner.image.node:prep2place-lab-node:1}") String nodeImage,
            @Value("${app.coding-lab.runner.image.python:prep2place-lab-python:1}") String pythonImage,
            @Value("${app.coding-lab.runner.docker.network-disabled:true}") boolean networkDisabled,
            @Value("${app.coding-lab.runner.docker.max-output-bytes:32768}") int maxOutputBytes,
            @Value("${app.coding-lab.runner.max-concurrent:3}") int maxConcurrent,
            @Value("${app.coding-lab.runner.queue-wait-seconds:15}") int queueWaitSeconds,
            @Value("${app.coding-lab.runner.build-timeout-seconds:60}") int buildTimeoutSeconds) {
        this.provider = provider == null ? "docker" : provider.trim().toLowerCase(Locale.ROOT);
        this.dockerBinary = dockerBinary;
        images.put(CodingRuntime.JAVA_JUNIT, javaImage);
        images.put(CodingRuntime.NODE_TEST, nodeImage);
        images.put(CodingRuntime.PYTHON_PYTEST, pythonImage);
        this.networkDisabled = networkDisabled;
        this.maxOutputBytes = Math.max(4096, maxOutputBytes);
        this.queueWaitSeconds = Math.max(1, queueWaitSeconds);
        this.buildTimeoutSeconds = Math.max(10, buildTimeoutSeconds);
        this.slots = new Semaphore(Math.max(1, maxConcurrent), true);
    }

    // ---------------------------------------------------------------------------------------------------- execute

    @Override
    public Result execute(Request req) {
        if (!"docker".equals(provider)) {
            return Result.unavailable(USER_UNAVAILABLE, "Unsupported runner provider '" + provider + "' (only 'docker' is implemented; set app.coding-lab.runner.provider=docker).");
        }
        try {
            if (!slots.tryAcquire(queueWaitSeconds, TimeUnit.SECONDS)) return Result.busy();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.busy();
        }
        Path dir = null;
        try {
            dir = Files.createTempDirectory("p2p-lab-");
            writeProject(dir, req.files());
            Files.createDirectories(dir.resolve(".p2p"));
            return runContainer(req, dir);
        } catch (IOException e) {
            log.error("Coding Lab sandbox I/O failure", e);
            return Result.unavailable(USER_UNAVAILABLE, "Sandbox I/O failure: " + e.getMessage());
        } finally {
            slots.release();
            deleteRecursively(dir);
        }
    }

    private Result runContainer(Request req, Path dir) {
        long start = System.nanoTime();
        String image = images.get(req.runtime());
        String suite = req.suite().dir();
        int timeout = Math.min(300, Math.max(5, req.timeoutSeconds()));
        int memory = Math.min(2048, Math.max(256, req.memoryLimitMb()));
        String name = "p2p-lab-" + UUID.randomUUID().toString().replace("-", "");

        // Run as the backend's own uid when we can (so files the container creates are removable by us);
        // if the backend is root, fall back to an unprivileged uid and open the directory instead.
        int uid = unixAttr(dir, "unix:uid"), gid = unixAttr(dir, "unix:gid");
        String user = null;
        if (uid > 0 && gid >= 0) user = uid + ":" + gid;
        else if (uid == 0) { user = "10001:10001"; openPermissions(dir); }
        else openPermissions(dir);

        List<String> cmd = new ArrayList<>(List.of(dockerBinary, "run", "--rm", "--name", name,
                "--read-only", "--tmpfs", "/tmp:rw,exec,nosuid,size=256m",
                "--cpus=1", "--memory=" + memory + "m", "--memory-swap=" + memory + "m", "--pids-limit=256",
                "--cap-drop=ALL", "--security-opt=no-new-privileges"));
        if (networkDisabled) cmd.add("--network=none");
        if (user != null) { cmd.add("--user"); cmd.add(user); }
        addEnv(cmd, "HOME", "/tmp");
        addEnv(cmd, "P2P_SUITE", suite);
        addEnv(cmd, "P2P_TIMEOUT", String.valueOf(timeout));
        addEnv(cmd, "P2P_BUILD_TIMEOUT", String.valueOf(buildTimeoutSeconds));
        if (req.domEnvironment()) addEnv(cmd, "P2P_DOM", "1");
        cmd.addAll(List.of("-v", dir.toAbsolutePath() + ":/workspace:rw", "-w", "/workspace", image));

        Process process;
        try {
            process = new ProcessBuilder(cmd).redirectErrorStream(false).start();
        } catch (IOException e) {
            return Result.unavailable(USER_UNAVAILABLE, "Could not start '" + dockerBinary + "': " + e.getMessage()
                    + ". Docker must be installed and on the PATH of the process running the backend. "
                    + "Hosts without a Docker socket (Render/Railway free tiers) cannot run the Coding Lab sandbox.");
        }
        try { process.getOutputStream().close(); } catch (IOException ignored) { }
        StreamCollector out = new StreamCollector(process.getInputStream(), maxOutputBytes);
        StreamCollector err = new StreamCollector(process.getErrorStream(), maxOutputBytes);
        Thread t1 = new Thread(out, "lab-out"), t2 = new Thread(err, "lab-err");
        t1.setDaemon(true); t2.setDaemon(true); t1.start(); t2.start();

        boolean done;
        try {
            done = process.waitFor(buildTimeoutSeconds + timeout + 25L, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            done = false;
        }
        int runtimeMs = (int) TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        if (!done) {
            log.warn("Sandbox watchdog fired, removing container {}", name);
            forceRemove(name);
            process.destroyForcibly();
            joinQuietly(t1); joinQuietly(t2);
            return new Result(Outcome.TIMED_OUT, true, read(dir, "build.log", MAX_LOG_CHARS), null, read(dir, "run-" + suite + ".log", MAX_LOG_CHARS),
                    runtimeMs, "Execution exceeded the time limit.", "Container did not finish within the watchdog window and was removed.");
        }
        joinQuietly(t1); joinQuietly(t2);
        int exit = process.exitValue();
        String dockerStderr = err.value().strip();

        String buildStatus = read(dir, "build.status", 16).strip();
        if (buildStatus.isEmpty()) return diagnoseNoOutput(image, req.runtime(), exit, dockerStderr, runtimeMs);

        boolean timedOut = Files.exists(dir.resolve(".p2p").resolve("timeout-" + suite));
        return new Result(timedOut ? Outcome.TIMED_OUT : Outcome.COMPLETED, "0".equals(buildStatus),
                read(dir, "build.log", MAX_LOG_CHARS), readOrNull(dir, "report-" + suite + ".xml", MAX_REPORT_CHARS),
                read(dir, "run-" + suite + ".log", MAX_LOG_CHARS), runtimeMs,
                timedOut ? "Execution exceeded the time limit." : null, null);
    }

    /** The runner script never got as far as writing build.status - i.e. Docker itself failed. Say exactly why. */
    private Result diagnoseNoOutput(String image, CodingRuntime runtime, int exit, String stderr, int runtimeMs) {
        String low = stderr.toLowerCase(Locale.ROOT);
        String folder = folderFor(runtime);
        if (low.contains("unable to find image") || low.contains("pull access denied") || low.contains("no such image")
                || low.contains("repository does not exist")) {
            return Result.unavailable(USER_UNAVAILABLE, "Runner image '" + image + "' is not built on this machine. Build the sandbox images with: "
                    + "sh backend/docker/coding-lab/build-images.sh   (or: docker build -t " + image + " backend/docker/coding-lab/" + folder + ")");
        }
        if (low.contains("cannot connect to the docker daemon") || low.contains("error during connect") || low.contains("is the docker daemon running")) {
            return Result.unavailable(USER_UNAVAILABLE, "The Docker daemon is not reachable from the backend process. Start Docker Desktop / the docker service. Detail: " + excerpt(stderr));
        }
        if (exit == 125 || exit == 126 || exit == 127) {
            return Result.unavailable(USER_UNAVAILABLE, "Docker could not start the runner (exit " + exit + "). If the image was built on Windows, rebuild it - "
                    + "the entrypoint script needs LF line endings. Detail: " + excerpt(stderr));
        }
        String why = exit == 137 ? "The sandbox was killed (most likely out of memory)." : "The sandbox stopped unexpectedly (exit code " + exit + ").";
        return new Result(Outcome.COMPLETED, false, why + (stderr.isBlank() ? "" : "\n" + excerpt(stderr)), null, "", runtimeMs, null, why);
    }

    // ---------------------------------------------------------------------------------------------------- status

    @Override
    public RunnerStatus status() {
        long now = System.currentTimeMillis();
        RunnerStatus c = cachedStatus;
        if (c != null && now - cachedAt < 10_000) return c;
        List<String> problems = new ArrayList<>();
        Map<String, Boolean> imageOk = new LinkedHashMap<>();
        boolean reachable = "docker".equals(provider) && exec(List.of(dockerBinary, "version", "--format", "{{.Server.Version}}"), 8);
        if (!"docker".equals(provider)) {
            problems.add("Unsupported runner provider '" + provider + "'.");
        } else if (!reachable) {
            problems.add("Docker is not reachable from the backend (is it installed, running, and on the PATH?).");
        }
        for (CodingRuntime rt : CodingRuntime.values()) {
            String image = images.get(rt);
            boolean ok = reachable && exec(List.of(dockerBinary, "image", "inspect", image), 8);
            imageOk.put(rt.name(), ok);
            if (reachable && !ok) problems.add("Image " + image + " is not built. Run: docker build -t " + image + " backend/docker/coding-lab/" + folderFor(rt));
        }
        cachedStatus = new RunnerStatus(problems.isEmpty(), reachable, imageOk, problems);
        cachedAt = now;
        return cachedStatus;
    }

    @EventListener(ApplicationReadyEvent.class)
    void logStatusOnStartup() {
        try {
            RunnerStatus s = status();
            if (s.ready()) log.info("Coding Lab runner ready ({} images present)", s.images().size());
            else s.problems().forEach(p -> log.warn("Coding Lab runner NOT ready: {}", p));
        } catch (Exception e) {
            log.warn("Could not determine Coding Lab runner status: {}", e.getMessage());
        }
    }

    // ---------------------------------------------------------------------------------------------------- helpers

    private static void addEnv(List<String> cmd, String k, String v) { cmd.add("-e"); cmd.add(k + "=" + v); }

    private static String folderFor(CodingRuntime rt) {
        return switch (rt) { case JAVA_JUNIT -> "java"; case NODE_TEST -> "node"; case PYTHON_PYTEST -> "python"; };
    }

    private static String excerpt(String s) { return s.length() > 400 ? s.substring(0, 400) + "…" : s; }

    private boolean exec(List<String> cmd, int seconds) {
        try {
            Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            p.getOutputStream().close();
            Thread drain = new Thread(() -> { try (InputStream in = p.getInputStream()) { in.transferTo(java.io.OutputStream.nullOutputStream()); } catch (IOException ignored) { } });
            drain.setDaemon(true); drain.start();
            if (!p.waitFor(seconds, TimeUnit.SECONDS)) { p.destroyForcibly(); return false; }
            return p.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static void writeProject(Path root, Map<String, String> files) throws IOException {
        for (Map.Entry<String, String> e : files.entrySet()) {
            String rel = WorkspaceRules.normalizePath(e.getKey()); // defence in depth: callers already sanitised
            Path target = root.resolve(rel).normalize();
            if (!target.startsWith(root)) throw new IOException("Illegal path outside project root: " + rel);
            Files.createDirectories(target.getParent());
            Files.writeString(target, e.getValue() == null ? "" : e.getValue(), StandardCharsets.UTF_8);
        }
    }

    private static int unixAttr(Path p, String attr) {
        try {
            Object v = Files.getAttribute(p, attr);
            return v instanceof Number n ? n.intValue() : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private static void openPermissions(Path root) {
        Set<PosixFilePermission> dirPerms = PosixFilePermissions.fromString("rwxrwxrwx");
        Set<PosixFilePermission> filePerms = PosixFilePermissions.fromString("rw-rw-rw-");
        try (Stream<Path> walk = Files.walk(root)) {
            walk.forEach(p -> {
                try { Files.setPosixFilePermissions(p, Files.isDirectory(p) ? dirPerms : filePerms); }
                catch (UnsupportedOperationException | IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    private static String read(Path dir, String name, int maxChars) {
        String s = readOrNull(dir, name, maxChars);
        return s == null ? "" : s;
    }

    private static String readOrNull(Path dir, String name, int maxChars) {
        Path f = dir.resolve(".p2p").resolve(name);
        try {
            if (!Files.isRegularFile(f)) return null;
            long size = Files.size(f);
            try (InputStream in = Files.newInputStream(f)) {
                byte[] bytes = in.readNBytes((int) Math.min(size, (long) maxChars * 4));
                String s = new String(bytes, StandardCharsets.UTF_8);
                return s.length() > maxChars ? s.substring(0, maxChars) + "\n… [truncated]" : s;
            }
        } catch (IOException e) {
            return null;
        }
    }

    private void forceRemove(String name) {
        try { new ProcessBuilder(dockerBinary, "rm", "-f", name).start().waitFor(8, TimeUnit.SECONDS); }
        catch (Exception e) { log.warn("Failed to force-remove container {}: {}", name, e.getMessage()); }
    }

    private static void joinQuietly(Thread t) {
        try { t.join(1500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    private static void deleteRecursively(Path path) {
        if (path == null) return;
        try (Stream<Path> walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) { } });
        } catch (IOException ignored) { }
    }

    /** Bounded stream drain: keeps reading (so the child never blocks on a full pipe) but stores only the first N bytes. */
    private static final class StreamCollector implements Runnable {
        private final InputStream in;
        private final int limit;
        private final java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
        private volatile boolean truncated;

        StreamCollector(InputStream in, int limit) { this.in = in; this.limit = limit; }

        @Override
        public void run() {
            byte[] chunk = new byte[4096];
            int n;
            try {
                while ((n = in.read(chunk)) != -1) {
                    int room = limit - buf.size();
                    if (room > 0) buf.write(chunk, 0, Math.min(n, room));
                    if (n > room) truncated = true;
                }
            } catch (IOException ignored) { }
        }

        String value() { return buf.toString(StandardCharsets.UTF_8) + (truncated ? "\n… [output truncated]" : ""); }
    }
}
