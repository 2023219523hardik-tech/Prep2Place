from pydantic import BaseModel


class InterviewAnalysisRequest(BaseModel):
    session_id: str
    video_url: str | None = None       # pre-uploaded object storage path/URL
    audio_url: str | None = None
    transcript: str | None = None
    duration_seconds: float = 0.0
    frame_sample_interval_seconds: float = 2.0


class BoundingBoxOut(BaseModel):
    x: int
    y: int
    w: int
    h: int


class ImportantFrameOut(BaseModel):
    timestamp: float
    confidence_score: float
    behavior_label: str
    reason: str
    bounding_boxes: list[BoundingBoxOut]
    face_count: int
    multiple_faces: bool
    no_face: bool
    poor_posture: bool
    looking_away: bool
    blur_score: float
    lighting_score: float


class VideoAnalysisResponse(BaseModel):
    session_id: str
    frames_analyzed: int
    important_frames_stored: int
    important_frames: list[ImportantFrameOut]
    avg_confidence_score: float
    behavior_summary: dict[str, int]  # behavior_label -> count


class SpeechAnalysisResponse(BaseModel):
    session_id: str
    speech_rate_wpm: float
    filler_words: dict[str, int]
    filler_word_total: int
    sentiment: str
    sentiment_polarity: float
    voice_energy_score: float | None
    pause_count: int | None
    pause_frequency_per_minute: float | None
    pronunciation_score: float | None
    emotion: str | None
    communication_score: float


class FinalInterviewReportOut(BaseModel):
    session_id: str
    overall_score: float
    technical_score: float
    communication_score: float
    confidence_score: float
    behavior_score: float
    weak_topics: list[str]
    improvement_suggestions: list[str]
    summary: str
