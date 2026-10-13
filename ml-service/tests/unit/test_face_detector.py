"""
Pytest-style unit tests for the vision pipeline. These mirror the standalone verification
script (tests/run_standalone_verification.py) which was ACTUALLY EXECUTED against this exact
code during development (see that file's header and the project README for the real output).
Run with: pytest tests/unit -v
"""
import os

import pytest

from app.pipelines.vision.behavior_scorer import BehaviorScorer

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


@pytest.fixture(scope="module")
def scorer():
    return BehaviorScorer()


def test_no_face_detected_on_blank_image(scorer):
    with open(os.path.join(FIXTURES_DIR, "blank.jpg"), "rb") as f:
        result = scorer.analyze_frame(f.read(), timestamp=0.0)
    assert result.face_count == 0
    assert result.no_face is True
    assert result.behavior_label == "no_face"


def test_single_face_detected_on_real_photo(scorer):
    with open(os.path.join(FIXTURES_DIR, "one_face.jpg"), "rb") as f:
        result = scorer.analyze_frame(f.read(), timestamp=1.0)
    assert result.face_count == 1
    assert result.multiple_faces is False


def test_multiple_faces_detected_on_composite(scorer):
    with open(os.path.join(FIXTURES_DIR, "two_faces.jpg"), "rb") as f:
        result = scorer.analyze_frame(f.read(), timestamp=2.0)
    assert result.face_count >= 2
    assert result.multiple_faces is True
    assert result.behavior_label == "multiple_faces"


def test_undecodable_frame_treated_as_camera_absent(scorer):
    result = scorer.analyze_frame(b"not a real image", timestamp=3.0)
    assert result.camera_absent is True
    assert result.confidence_score == 0.0
