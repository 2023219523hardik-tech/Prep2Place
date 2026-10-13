"""
Combines behavior (vision), speech, and transcript-QA-similarity signals into the final
interview evaluation the spec asks for. Real, explainable weighted aggregation — the natural
place to layer a learned scoring model later once labeled outcome data exists (docs/MODELS.md).
"""
from dataclasses import dataclass

from app.pipelines.nlp.similarity import similarity_score
from app.pipelines.speech.speech_analyzer import SpeechAnalysisResult
from app.pipelines.vision.behavior_scorer import BehaviorFrameResult

# Weighted contribution of each dimension to the overall score.
WEIGHTS = {"technical": 0.35, "communication": 0.25, "confidence": 0.20, "behavior": 0.20}


@dataclass
class FinalEvaluation:
    overall_score: float
    technical_score: float
    communication_score: float
    confidence_score: float
    behavior_score: float
    weak_topics: list[str]
    improvement_suggestions: list[str]
    summary: str


def evaluate_interview(
    frame_results: list[BehaviorFrameResult],
    speech_result: SpeechAnalysisResult | None,
    transcript: str | None,
    reference_answers: list[str] | None = None,
) -> FinalEvaluation:
    behavior_score = _aggregate_behavior_score(frame_results)
    confidence_score = _aggregate_confidence(frame_results)
    communication_score = speech_result.communication_score if speech_result else 0.0
    technical_score = _technical_score(transcript, reference_answers)

    overall = round(
        technical_score * WEIGHTS["technical"]
        + communication_score * WEIGHTS["communication"]
        + confidence_score * WEIGHTS["confidence"]
        + behavior_score * WEIGHTS["behavior"], 1,
    )

    weak_topics = _weak_dimensions(technical_score, communication_score, confidence_score, behavior_score)
    suggestions = _suggestions(weak_topics, frame_results, speech_result)
    summary = _summary(overall)

    return FinalEvaluation(
        overall_score=overall, technical_score=technical_score, communication_score=communication_score,
        confidence_score=confidence_score, behavior_score=behavior_score,
        weak_topics=weak_topics, improvement_suggestions=suggestions, summary=summary,
    )


def _aggregate_behavior_score(frames: list[BehaviorFrameResult]) -> float:
    if not frames:
        return 0.0
    engaged = sum(1 for f in frames if f.behavior_label == "engaged")
    return round((engaged / len(frames)) * 100, 1)


def _aggregate_confidence(frames: list[BehaviorFrameResult]) -> float:
    if not frames:
        return 0.0
    return round(sum(f.confidence_score for f in frames) / len(frames), 1)


def _technical_score(transcript: str | None, reference_answers: list[str] | None) -> float:
    if not transcript or not reference_answers:
        return 0.0
    scores = [similarity_score(transcript, ref) for ref in reference_answers]
    return round(sum(scores) / len(scores), 1) if scores else 0.0


def _weak_dimensions(technical: float, communication: float, confidence: float, behavior: float) -> list[str]:
    dims = {"Technical Knowledge": technical, "Communication": communication,
            "Confidence": confidence, "Behavior": behavior}
    return [name for name, score in dims.items() if score < 55]


def _suggestions(weak_topics: list[str], frames: list[BehaviorFrameResult], speech: SpeechAnalysisResult | None) -> list[str]:
    suggestions = []
    if "Technical Knowledge" in weak_topics:
        suggestions.append("Review core concepts for the questions asked — answers didn't closely match expected content.")
    if "Communication" in weak_topics and speech:
        if speech.filler_word_total > 5:
            suggestions.append(f"Reduce filler words ({speech.filler_word_total} detected) for clearer delivery.")
        if speech.speech_rate_wpm and speech.speech_rate_wpm < 100:
            suggestions.append("Try speaking a bit faster/more fluently — pace was slower than ideal.")
    if "Confidence" in weak_topics:
        suggestions.append("Work on maintaining steady eye contact and posture during answers.")
    if "Behavior" in weak_topics:
        looking_away_count = sum(1 for f in frames if f.looking_away)
        if looking_away_count:
            suggestions.append(f"Looked away from camera in {looking_away_count} of {len(frames)} sampled frames.")
    if not suggestions:
        suggestions.append("Strong overall performance — keep practicing to stay sharp.")
    return suggestions


def _summary(overall: float) -> str:
    if overall >= 75:
        return "Strong interview performance overall."
    if overall >= 50:
        return "Solid attempt with room for improvement in the flagged areas."
    return "Significant preparation gaps detected — focus on the weak areas before your next attempt."
