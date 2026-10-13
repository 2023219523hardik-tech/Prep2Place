"""Background task: full video analysis pipeline (frame sampling -> behavior scoring ->
important-frame filtering -> persistence). Runs synchronously in local dev (eager mode) or
on a real Celery worker in production — same function either way."""
import logging

from app.config.settings import get_settings
from app.pipelines.vision.behavior_scorer import BehaviorScorer
from app.pipelines.vision.frame_sampler import is_important, sample_frames
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="analyze_interview_video")
def analyze_interview_video_task(session_id: str, video_path: str) -> dict:
    settings = get_settings()
    scorer = BehaviorScorer(min_face_size=settings.face_confidence_min_size)

    important_frames = []
    previous_score = None
    total_frames = 0

    for sampled in sample_frames(video_path, interval_seconds=settings.frame_sample_interval_seconds):
        total_frames += 1
        result = scorer.analyze_frame(sampled.jpeg_bytes, timestamp=sampled.timestamp)
        if is_important(previous_score, result.confidence_score, settings.important_frame_score_delta):
            important_frames.append(result)
            previous_score = result.confidence_score

    logger.info("Interview video analyzed", extra={
        "session_id": session_id, "total_frames": total_frames, "important_frames": len(important_frames),
    })

    return {
        "session_id": session_id,
        "frames_analyzed": total_frames,
        "important_frames_stored": len(important_frames),
        "important_frames": [
            {
                "timestamp": f.timestamp, "confidence_score": f.confidence_score,
                "behavior_label": f.behavior_label, "reason": f.reason,
                "bounding_boxes": f.bounding_boxes, "face_count": f.face_count,
                "multiple_faces": f.multiple_faces, "no_face": f.no_face,
                "poor_posture": f.poor_posture, "looking_away": f.looking_away,
                "blur_score": f.blur_score, "lighting_score": f.lighting_score,
            }
            for f in important_frames
        ],
    }
