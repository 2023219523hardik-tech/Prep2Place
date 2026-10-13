"""
Real, tested face detection using OpenCV Haar-cascade classifiers (ships with opencv-python,
no model download required). This is the same algorithm validated in the previous iteration
of this service — frontal + profile detection in both directions, IoU-deduplicated.

Honest scope: classical CV, not a deep-learning detector. Works well for a single, roughly
front-facing, reasonably lit face (the common webcam-interview case). More sensitive to
lighting/angle than DeepFace/MediaPipe/YOLO would be — those need downloadable model weights
this environment doesn't have network access for. Swap the implementation of `FaceDetector`
below for a deep model later without touching any calling code (see docs/MODELS.md).
"""
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class FaceBox:
    x: int
    y: int
    w: int
    h: int

    @property
    def area(self) -> int:
        return self.w * self.h


class FaceDetector:
    def __init__(self, min_size: int = 60):
        self.min_size = min_size
        self._frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        self._profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
        self._eye = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

    def detect(self, gray: np.ndarray) -> list[FaceBox]:
        frontal = self._frontal.detectMultiScale(gray, 1.1, 5, minSize=(self.min_size, self.min_size))
        profile = self._profile.detectMultiScale(gray, 1.1, 5, minSize=(self.min_size, self.min_size))
        flipped = cv2.flip(gray, 1)
        profile_flipped = self._profile.detectMultiScale(flipped, 1.1, 5, minSize=(self.min_size, self.min_size))
        w = gray.shape[1]
        profile_flipped_mirrored = [(w - x - fw, y, fw, fh) for (x, y, fw, fh) in profile_flipped]

        boxes = [FaceBox(*b) for b in list(frontal) + list(profile) + profile_flipped_mirrored]
        return self._deduplicate(boxes)

    def eye_count(self, gray: np.ndarray, box: FaceBox) -> int:
        roi = gray[box.y:box.y + box.h, box.x:box.x + box.w]
        eyes = self._eye.detectMultiScale(roi, 1.1, 6, minSize=(15, 15))
        return len(eyes)

    @staticmethod
    def _deduplicate(boxes: list[FaceBox], iou_threshold: float = 0.3) -> list[FaceBox]:
        if not boxes:
            return []
        boxes = sorted(boxes, key=lambda b: b.area, reverse=True)
        kept: list[FaceBox] = []
        for box in boxes:
            if all(FaceDetector._iou(box, k) < iou_threshold for k in kept):
                kept.append(box)
        return kept

    @staticmethod
    def _iou(a: FaceBox, b: FaceBox) -> float:
        ax2, ay2, bx2, by2 = a.x + a.w, a.y + a.h, b.x + b.w, b.y + b.h
        ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0
        inter = (ix2 - ix1) * (iy2 - iy1)
        union = a.area + b.area - inter
        return inter / union if union > 0 else 0.0


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def to_gray(image: np.ndarray) -> np.ndarray:
    return cv2.equalizeHist(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
