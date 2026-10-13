"""
Interview analysis endpoints. Video/speech analysis run through Celery (eager-mode by
default, so no broker is required to exercise these locally — see app/workers).
"""
from collections import Counter

from fastapi import APIRouter, HTTPException

from app.core.exceptions import ResourceNotFoundError
from app.pipelines.speech.speech_analyzer import analyze_speech
from app.schemas.interview import (
    BoundingBoxOut, FinalInterviewReportOut, ImportantFrameOut, InterviewAnalysisRequest,
    SpeechAnalysisResponse, VideoAnalysisResponse,
)
from app.services.interview_evaluation_service import evaluate_interview
from app.pipelines.vision.behavior_scorer import BehaviorFrameResult
from app.workers.interview_tasks import analyze_interview_video_task

router = APIRouter(tags=["interview"])

# In-memory store of last analysis per session — a real deployment persists these via
# InterviewReportRepository (see app/repositories) instead of process memory.
_LAST_VIDEO_RESULT: dict[str, dict] = {}
_LAST_SPEECH_RESULT: dict[str, dict] = {}


@router.post("/analyze/video", response_model=VideoAnalysisResponse)
async def analyze_video(request: InterviewAnalysisRequest):
    if not request.video_url:
        raise HTTPException(400, "video_url is required for video analysis")

    result = analyze_interview_video_task.delay(request.session_id, request.video_url).get()
    _LAST_VIDEO_RESULT[request.session_id] = result

    behavior_summary = Counter(f["behavior_label"] for f in result["important_frames"])
    avg_confidence = (
        sum(f["confidence_score"] for f in result["important_frames"]) / len(result["important_frames"])
        if result["important_frames"] else 0.0
    )

    return VideoAnalysisResponse(
        session_id=request.session_id, frames_analyzed=result["frames_analyzed"],
        important_frames_stored=result["important_frames_stored"],
        important_frames=[
            ImportantFrameOut(
                timestamp=f["timestamp"], confidence_score=f["confidence_score"],
                behavior_label=f["behavior_label"], reason=f["reason"],
                bounding_boxes=[BoundingBoxOut(**b) for b in f["bounding_boxes"]],
                face_count=f["face_count"], multiple_faces=f["multiple_faces"], no_face=f["no_face"],
                poor_posture=f["poor_posture"], looking_away=f["looking_away"],
                blur_score=f["blur_score"], lighting_score=f["lighting_score"],
            )
            for f in result["important_frames"]
        ],
        avg_confidence_score=round(avg_confidence, 1),
        behavior_summary=dict(behavior_summary),
    )


@router.post("/analyze/speech", response_model=SpeechAnalysisResponse)
async def analyze_speech_endpoint(request: InterviewAnalysisRequest):
    result = analyze_speech(
        transcript=request.transcript or "", duration_seconds=request.duration_seconds,
        wav_path=request.audio_url,
    )
    _LAST_SPEECH_RESULT[request.session_id] = result.__dict__

    return SpeechAnalysisResponse(
        session_id=request.session_id, speech_rate_wpm=result.speech_rate_wpm,
        filler_words=result.filler_words, filler_word_total=result.filler_word_total,
        sentiment=result.sentiment, sentiment_polarity=result.sentiment_polarity,
        voice_energy_score=result.voice_energy_score, pause_count=result.pause_count,
        pause_frequency_per_minute=result.pause_frequency_per_minute,
        pronunciation_score=result.pronunciation_score, emotion=result.emotion,
        communication_score=result.communication_score,
    )


@router.post("/analyze/interview", response_model=FinalInterviewReportOut)
async def analyze_interview(request: InterviewAnalysisRequest):
    """Convenience endpoint: runs video + speech analysis (if not already run for this
    session) then combines them via /generate/report's logic in one call."""
    if request.video_url and request.session_id not in _LAST_VIDEO_RESULT:
        await analyze_video(request)
    if request.session_id not in _LAST_SPEECH_RESULT:
        await analyze_speech_endpoint(request)

    return await generate_report(request.session_id, request.transcript)


@router.post("/generate/report", response_model=FinalInterviewReportOut)
async def generate_report(session_id: str, transcript: str | None = None, reference_answers: list[str] | None = None):
    video_result = _LAST_VIDEO_RESULT.get(session_id)
    speech_result_dict = _LAST_SPEECH_RESULT.get(session_id)

    if not video_result and not speech_result_dict:
        raise ResourceNotFoundError(f"No analysis found for session {session_id} — call /analyze/video "
                                     f"and/or /analyze/speech first.")

    frames = [
        BehaviorFrameResult(
            timestamp=f["timestamp"], face_count=f["face_count"], face_visible=True,
            multiple_faces=f["multiple_faces"], no_face=f["no_face"], camera_absent=False,
            looking_away=f["looking_away"], poor_posture=f["poor_posture"],
            eye_contact_score=0, posture_score=0, confidence_score=f["confidence_score"],
            behavior_label=f["behavior_label"], reason=f["reason"],
        )
        for f in (video_result["important_frames"] if video_result else [])
    ]

    from app.pipelines.speech.speech_analyzer import SpeechAnalysisResult
    speech_result = SpeechAnalysisResult(**speech_result_dict) if speech_result_dict else None

    evaluation = evaluate_interview(frames, speech_result, transcript, reference_answers)

    return FinalInterviewReportOut(
        session_id=session_id, overall_score=evaluation.overall_score,
        technical_score=evaluation.technical_score, communication_score=evaluation.communication_score,
        confidence_score=evaluation.confidence_score, behavior_score=evaluation.behavior_score,
        weak_topics=evaluation.weak_topics, improvement_suggestions=evaluation.improvement_suggestions,
        summary=evaluation.summary,
    )
