"""
Real frame extraction from a video file at a configurable interval, using OpenCV's
VideoCapture (genuinely functional, no model weights needed).

Also implements "only store important frames" from the spec: a frame is kept only if its
behavior score changes by more than `score_delta_threshold` from the last *stored* frame,
so a candidate calmly answering for 3 minutes doesn't produce 90 near-identical stored frames.
"""
from dataclasses import dataclass
from typing import Iterator

import cv2


@dataclass
class SampledFrame:
    timestamp: float
    frame_index: int
    jpeg_bytes: bytes


def sample_frames(video_path: str, interval_seconds: float = 2.0) -> Iterator[SampledFrame]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(round(fps * interval_seconds)))

    frame_index = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % frame_interval == 0:
                ok_encode, buf = cv2.imencode(".jpg", frame)
                if ok_encode:
                    timestamp = frame_index / fps
                    yield SampledFrame(timestamp=timestamp, frame_index=frame_index, jpeg_bytes=buf.tobytes())
            frame_index += 1
    finally:
        cap.release()


def is_important(previous_score: float | None, current_score: float, threshold: float = 15.0) -> bool:
    """A frame is worth persisting if it's the first one, or its confidence score moved
    enough from the last stored frame to represent a meaningful behavioural change."""
    if previous_score is None:
        return True
    return abs(current_score - previous_score) >= threshold
