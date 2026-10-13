"""
Fuses face-detection + pose/gaze signals into the behavior labels and confidence score the
spec asks for: poor posture, looking away, eye contact, multiple faces, no face, camera
absence, face visibility — plus a numeric confidence estimate.

`phone_usage` and `lighting_quality`/`blur` are included in the output contract (so the API
shape matches the spec exactly) but are honestly-labeled placeholders: phone/object detection
needs a real object detector (YOLO) with downloadable weights; lighting/blur quality scoring
needs either a trained model or careful classical heuristics (Laplacian-variance blur detection
IS implemented below since it needs no model — see `_blur_score`).
"""
from dataclasses import dataclass, field

import cv2
import numpy as np

from app.pipelines.vision.face_detector import FaceDetector, decode_image, to_gray
from app.pipelines.vision.pose_gaze import PoseGazeEstimator


@dataclass
class BehaviorFrameResult:
    timestamp: float
    face_count: int
    face_visible: bool
    multiple_faces: bool
    no_face: bool
    camera_absent: bool
    looking_away: bool
    poor_posture: bool
    eye_contact_score: float
    posture_score: float
    confidence_score: float
    behavior_label: str
    reason: str
    bounding_boxes: list[dict] = field(default_factory=list)
    pose_landmarks: list[dict] | None = None  # None: real landmarks need a deep pose model (see docs/MODELS.md)
    phone_usage_detected: bool | None = None  # None: needs a real object detector (see docs/MODELS.md)
    blur_score: float = 0.0
    lighting_score: float = 0.0
    formal_attire_detected: bool = True
    attire_type: str = "FORMAL"
    attire_score: float = 85.0
    attire_warning: str | None = None


class BehaviorScorer:
    def __init__(self, min_face_size: int = 60):
        self.face_detector = FaceDetector(min_size=min_face_size)
        self.pose_gaze = PoseGazeEstimator()

    def analyze_frame(self, image_bytes: bytes, timestamp: float) -> BehaviorFrameResult:
        image = decode_image(image_bytes)
        if image is None:
            return BehaviorFrameResult(
                timestamp=timestamp, face_count=0, face_visible=False, multiple_faces=False,
                no_face=True, camera_absent=True, looking_away=True, poor_posture=True,
                eye_contact_score=0.0, posture_score=0.0, confidence_score=0.0,
                behavior_label="camera_absent", reason="Frame could not be decoded — camera feed likely absent.",
            )

        gray = to_gray(image)
        faces = self.face_detector.detect(gray)
        blur_score = self._blur_score(gray)
        lighting_score = self._lighting_score(gray)

        if not faces:
            return BehaviorFrameResult(
                timestamp=timestamp, face_count=0, face_visible=False, multiple_faces=False,
                no_face=True, camera_absent=False, looking_away=True, poor_posture=True,
                eye_contact_score=0.0, posture_score=0.0, confidence_score=0.0,
                behavior_label="no_face", reason="No face detected in frame.",
                blur_score=blur_score, lighting_score=lighting_score,
            )

        primary = max(faces, key=lambda b: b.area)
        eye_count = self.face_detector.eye_count(gray, primary)
        pose_result = self.pose_gaze.estimate(gray, primary, eye_count)
        formal_detected, attire_type, attire_score, attire_warn = self._detect_attire(image, gray, primary)

        multiple_faces = len(faces) > 1
        poor_posture = pose_result.posture_score < 60
        confidence = round((pose_result.posture_score + pose_result.eye_contact_score) / 2, 1)

        if multiple_faces:
            label, reason = "multiple_faces", f"{len(faces)} faces detected in frame — strictly prohibited; possible unauthorized proxy assistance."
        elif not formal_detected:
            label, reason = "casual_attire", f"Candidate attire is casual ({attire_type}). Professional formal attire is mandatory."
        elif pose_result.looking_away:
            label, reason = "looking_away", "Eyes not consistently detected — candidate may be looking away."
        elif poor_posture:
            label, reason = "poor_posture", "Face position suggests slouching or leaning out of frame."
        else:
            label, reason = "engaged", "Face centered, eyes visible, posture stable, formal attire verified."

        return BehaviorFrameResult(
            timestamp=timestamp, face_count=len(faces), face_visible=True, multiple_faces=multiple_faces,
            no_face=False, camera_absent=False, looking_away=pose_result.looking_away,
            poor_posture=poor_posture, eye_contact_score=pose_result.eye_contact_score,
            posture_score=pose_result.posture_score, confidence_score=confidence,
            behavior_label=label, reason=reason,
            bounding_boxes=[{"x": f.x, "y": f.y, "w": f.w, "h": f.h} for f in faces],
            blur_score=blur_score, lighting_score=lighting_score,
            formal_attire_detected=formal_detected, attire_type=attire_type,
            attire_score=attire_score, attire_warning=attire_warn,
        )

    @staticmethod
    def _detect_attire(image: np.ndarray | None, gray: np.ndarray, primary) -> tuple[bool, str, float, str | None]:
        """Classifies attire in torso region below face into formal vs casual."""
        h_img, w_img = gray.shape[:2]
        y1 = min(h_img - 1, primary.y + int(primary.h * 0.9))
        y2 = min(h_img, primary.y + int(primary.h * 2.2))
        x1 = max(0, primary.x - int(primary.w * 0.4))
        x2 = min(w_img, primary.x + primary.w + int(primary.w * 0.4))

        if y2 - y1 < 20 or x2 - x1 < 20:
            return True, "FORMAL", 80.0, None

        roi_gray = gray[y1:y2, x1:x2]
        edges = cv2.Canny(roi_gray, 40, 120)

        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=15, minLineLength=12, maxLineGap=4)
        collar_lines = 0
        if lines is not None:
            for line in lines:
                lx1, ly1, lx2, ly2 = line[0]
                angle = abs(np.arctan2(ly2 - ly1, lx2 - lx1) * 180.0 / np.pi)
                if 20 <= angle <= 75:
                    collar_lines += 1

        skin_ratio = 0.0
        if image is not None:
            roi_bgr = image[y1:y2, x1:x2]
            hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
            skin_mask = cv2.inRange(hsv, np.array([0, 30, 60]), np.array([25, 200, 255]))
            skin_ratio = float(np.mean(skin_mask > 0))

        has_collar = collar_lines >= 3
        excessive_skin = skin_ratio > 0.42

        if excessive_skin or (not has_collar and collar_lines <= 1):
            score = round(max(20.0, 55.0 - skin_ratio * 40.0), 1)
            return False, "CASUAL", score, "Casual attire detected (round-neck/t-shirt without collar). Professional formal attire is required."
        else:
            score = round(min(98.0, 75.0 + min(20.0, collar_lines * 4.0)), 1)
            return True, "FORMAL", score, None

    @staticmethod
    def _blur_score(gray: np.ndarray) -> float:
        """Laplacian variance — a real, well-known classical blur metric (higher = sharper)."""
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return round(min(100.0, variance / 5.0), 1)

    @staticmethod
    def _lighting_score(gray: np.ndarray) -> float:
        """Real heuristic: penalizes frames that are too dark or blown out, based on mean brightness."""
        mean_brightness = float(np.mean(gray))
        ideal = 127.5
        deviation = abs(mean_brightness - ideal) / ideal
        return round(max(0.0, 100.0 - deviation * 100), 1)
