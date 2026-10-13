"""
Standalone verification script — NO pytest/fastapi/pydantic/sqlalchemy required, only
opencv-python, numpy, and scikit-learn (the packages actually available in the sandbox this
service was developed in). This was ACTUALLY RUN against this exact codebase; see the
project README for the real terminal output it produced.

The pytest-style files in tests/unit/ cover the same logic in the standard, CI-friendly
format for when you `pip install -r requirements-dev.txt` in an environment with internet
access — this script exists purely as proof-of-work for the parts developed offline.

Run: python tests/run_standalone_verification.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def check(label: str, condition: bool):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    if not condition:
        raise AssertionError(label)


def test_vision_pipeline():
    print("Vision pipeline (face_detector + behavior_scorer):")
    from app.pipelines.vision.behavior_scorer import BehaviorScorer

    scorer = BehaviorScorer()

    with open(os.path.join(FIXTURES, "blank.jpg"), "rb") as f:
        r = scorer.analyze_frame(f.read(), timestamp=0.0)
    check("blank image -> 0 faces detected", r.face_count == 0 and r.no_face)

    with open(os.path.join(FIXTURES, "one_face.jpg"), "rb") as f:
        r = scorer.analyze_frame(f.read(), timestamp=1.0)
    check("real photo -> exactly 1 face detected", r.face_count == 1)

    with open(os.path.join(FIXTURES, "two_faces.jpg"), "rb") as f:
        r = scorer.analyze_frame(f.read(), timestamp=2.0)
    check("composite image -> 2+ faces detected, flagged multiple_faces", r.face_count >= 2 and r.multiple_faces)

    r = scorer.analyze_frame(b"not a real image", timestamp=3.0)
    check("undecodable bytes -> camera_absent, not a crash", r.camera_absent and r.confidence_score == 0.0)


def test_frame_sampler():
    print("Frame sampler (real OpenCV VideoCapture):")
    from app.pipelines.vision.frame_sampler import is_important, sample_frames

    frames = list(sample_frames(os.path.join(FIXTURES, "sample_video.mp4"), interval_seconds=1.0))
    check(f"sampled {len(frames)} frames from 3s video at 1s interval (expect 3)", len(frames) == 3)

    prev, kept = None, 0
    for score in [50, 52, 51, 90, 91, 30]:
        if is_important(prev, score, threshold=15.0):
            kept += 1
            prev = score
    check("important-frame filter reduces near-duplicate scores", kept < 6)


def test_nlp_pipeline():
    print("NLP pipeline (TF-IDF similarity + JD parsing + roadmap):")
    from app.pipelines.nlp.jd_parser import parse_job_description
    from app.pipelines.nlp.similarity import similarity_score
    from app.pipelines.recommendation.roadmap_builder import build_roadmap

    reference = "array,linked list,index,insertion,memory,contiguous"
    relevant = "An ArrayList uses a dynamic array for fast index-based access."
    irrelevant = "I enjoy playing football on weekends."
    check("relevant answer scores higher than irrelevant",
          similarity_score(relevant, reference) > similarity_score(irrelevant, reference))

    jd = "Backend Developer needed: Java, Spring Boot, SQL, Docker, AWS, 3+ years experience."
    parsed = parse_job_description(jd)
    check("JD parser extracts expected skill count", len(parsed.required_skills) >= 5)
    check("JD parser extracts experience requirement", parsed.min_experience_years == 3)

    roadmap = build_roadmap({"java", "sql"}, parsed.required_skills, hours_per_week=10)
    check("roadmap correctly matches known skills", "java" in roadmap.matched_topics)
    check("roadmap correctly flags missing skills", "spring boot" in roadmap.missing_topics)


def test_speech_pipeline():
    print("Speech pipeline (stdlib-only audio energy + text metrics):")
    from app.pipelines.speech.audio_metrics import analyze_energy
    from app.pipelines.speech.text_metrics import count_filler_words, speech_rate_wpm

    result = analyze_energy(os.path.join(FIXTURES, "sample_speech.wav"))
    check(f"detected {result.pause_count} pauses in synthetic tone-pause-tone-pause-tone clip (expect 2)",
          result.pause_count == 2)

    check("speech rate computes correctly", speech_rate_wpm("word " * 150, 60) == 150.0)
    check("filler words detected", count_filler_words("Um, this is like, basically fine.").get("um") == 1)


def test_mock_test_analytics():
    print("Mock test analytics:")
    from app.pipelines.analytics.mock_test_analyzer import QuestionAttempt, analyze_mock_test

    attempts = [
        QuestionAttempt("q1", "Arrays", "EASY", True, 30),
        QuestionAttempt("q2", "DP", "HARD", False, 120),
        QuestionAttempt("q3", "DP", "HARD", False, 110),
    ]
    report = analyze_mock_test(attempts)
    check("weak topic correctly identified", "DP" in report.weak_topics)
    check("accuracy computed correctly", report.accuracy == round(1 / 3 * 100, 1))


def test_resource_ranking():
    print("Resource ranking formula:")
    from app.pipelines.recommendation.resource_ranker import VideoCandidate, rank_videos

    candidates = [
        VideoCandidate("v1", "2hr video, low engagement", "A", 500000, 2000, 7200, "DP"),
        VideoCandidate("v2", "20min video, high engagement", "B", 200000, 15000, 1200, "DP"),
    ]
    ranked = rank_videos(candidates, target_duration_minutes=20)
    check("ideal-length high-engagement video ranked first despite fewer views", ranked[0].video_id == "v2")


def test_evaluation_combiner():
    print("Final interview evaluation combiner:")
    from app.pipelines.speech.speech_analyzer import analyze_speech
    from app.pipelines.vision.behavior_scorer import BehaviorFrameResult
    from app.services.interview_evaluation_service import evaluate_interview

    frames = [BehaviorFrameResult(
        timestamp=0, face_count=1, face_visible=True, multiple_faces=False, no_face=False,
        camera_absent=False, looking_away=False, poor_posture=False, eye_contact_score=90,
        posture_score=90, confidence_score=90, behavior_label="engaged", reason="ok",
    )]
    speech = analyze_speech("I designed a REST API with proper authentication.", 20)
    result = evaluate_interview(frames, speech, "I designed a REST API with proper authentication.",
                                 ["A good answer discusses REST API design and authentication."])
    check("overall score computed in valid range", 0 <= result.overall_score <= 100)
    check("summary generated", bool(result.summary))


def test_local_storage():
    print("Local object storage:")
    from app.storage.local_storage import LocalObjectStorage

    storage = LocalObjectStorage("/tmp/ml_service_verification_storage")
    storage.put("test/key.txt", b"hello")
    check("stored object exists", storage.exists("test/key.txt"))
    check("stored object content matches", storage.get("test/key.txt") == b"hello")
    storage.delete("test/key.txt")
    check("deleted object no longer exists", not storage.exists("test/key.txt"))


def test_question_generator():
    print("Resume/JD interview question generator (prompt building, JSON repair, mock LLM):")
    import asyncio
    from app.pipelines.recommendation.interview_question_generator import build_prompt, extract_json, generate_questions
    from app.services.llm.mock_provider import MockLLMProvider

    prompt, skills = build_prompt("Java, Spring Boot, SQL developer.", "Need Java, AWS skills.", 5, 3)
    check("prompt building extracts skills from resume+JD", "java" in skills)

    check("JSON extraction handles markdown-fenced output",
          extract_json('```json\n{"a": 1}\n```') == {"a": 1})
    check("JSON extraction handles preamble text before JSON",
          extract_json('Sure, here it is:\n{"a": 1}\nEnjoy!') == {"a": 1})
    check("JSON extraction returns None for garbage input", extract_json("not json") is None)

    result = asyncio.run(generate_questions(
        MockLLMProvider(), "Java, Spring Boot, SQL developer.", "Need Java, AWS, Docker skills.",
        num_technical=4, num_hr=2,
    ))
    check("end-to-end generation via mock provider returns requested counts",
          len(result.technical_questions) == 4 and len(result.hr_questions) == 2)


if __name__ == "__main__":
    tests = [
        test_vision_pipeline, test_frame_sampler, test_nlp_pipeline, test_speech_pipeline,
        test_mock_test_analytics, test_resource_ranking, test_evaluation_combiner, test_local_storage,
        test_question_generator,
    ]
    for t in tests:
        t()
        print()
    print("ALL STANDALONE VERIFICATIONS PASSED")
