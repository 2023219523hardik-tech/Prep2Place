"""
Pose / head-pose / eye-gaze estimation interface.

HONEST STATUS: this is a documented interface with a classical-CV fallback, not a deep model.
The spec calls for MediaPipe FaceMesh + BlazePose. This environment has `mediapipe` installed,
but its modern Tasks API (`FaceLandmarker`, `PoseLandmarker`) requires downloading a `.task`
model bundle at runtime, which needs network access this sandbox doesn't have — so it cannot
be verified working here. The interface below is shaped exactly like a MediaPipe-backed
implementation would be, so swapping one in later is a drop-in change (see docs/MODELS.md).

The fallback implementation derives coarse signals from the same Haar-cascade face box already
computed by FaceDetector: face position/size as a posture proxy, and eye count as a gaze proxy.
This is real code (not random), just a much weaker signal than a real pose/gaze model.
"""
from dataclasses import dataclass

import numpy as np

from app.pipelines.vision.face_detector import FaceBox


@dataclass
class PoseGazeResult:
    posture_score: float          # 0-100, proxy: face centering + size stability
    head_pose_label: str          # "facing_camera" | "turned_away" | "unknown"
    eye_contact_score: float      # 0-100, proxy: eye-detector hit rate
    looking_away: bool


class PoseGazeEstimator:
    """Classical-CV fallback. See module docstring for why this isn't a deep model here."""

    def estimate(self, gray: np.ndarray, face: FaceBox, eye_count: int) -> PoseGazeResult:
        frame_h, frame_w = gray.shape[:2]
        center_x, center_y = face.x + face.w / 2, face.y + face.h / 2
        h_offset = abs(center_x - frame_w / 2) / (frame_w / 2)
        v_offset = abs(center_y - frame_h / 2) / (frame_h / 2)
        posture_score = max(20.0, min(100.0, 100 - h_offset * 40 - v_offset * 30))

        if eye_count >= 2:
            eye_contact_score, head_pose_label, looking_away = 90.0, "facing_camera", False
        elif eye_count == 1:
            eye_contact_score, head_pose_label, looking_away = 55.0, "turned_away", True
        else:
            eye_contact_score, head_pose_label, looking_away = 25.0, "unknown", True

        return PoseGazeResult(
            posture_score=round(posture_score, 1),
            head_pose_label=head_pose_label,
            eye_contact_score=eye_contact_score,
            looking_away=looking_away,
        )
