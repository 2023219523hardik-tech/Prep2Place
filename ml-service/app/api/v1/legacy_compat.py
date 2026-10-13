"""
Backward-compatibility routes matching the EXACT contract of the earlier Flask-based version
of this service (POST /analyze-frame, POST /evaluate-answer) — so the Spring Boot backend's
PythonMlVideoAnalysisService/PythonNlpClient (built against that contract) keep working
unchanged against this FastAPI rewrite. Same underlying tested logic either way; only the
framework and route shape differ. New integrations should prefer the versioned
/api/v1/analyze/video and /api/v1/roadmap-style endpoints instead.
"""
from fastapi import APIRouter, UploadFile, File

from app.pipelines.nlp.similarity import keyword_coverage, similarity_score
from app.pipelines.vision.behavior_scorer import BehaviorScorer
from pydantic import BaseModel

router = APIRouter(tags=["legacy-compat"])
_scorer = BehaviorScorer()


class LegacyEvaluateAnswerRequest(BaseModel):
    transcript: str = ""
    expectedKeywords: str = ""


@router.post("/analyze-frame")
async def legacy_analyze_frame(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = _scorer.analyze_frame(image_bytes, timestamp=0.0)
    return {
        "faceVisibilityScore": 100.0 if result.face_visible else 0.0,
        "eyeContactScore": result.eye_contact_score,
        "postureScore": result.posture_score,
        "confidenceScore": result.confidence_score,
        "faceCount": result.face_count,
        "suspiciousObjectDetected": bool(result.phone_usage_detected),
        "formalAttireDetected": getattr(result, "formal_attire_detected", True),
        "attireType": getattr(result, "attire_type", "FORMAL"),
        "attireScore": getattr(result, "attire_score", 85.0),
        "attireWarning": getattr(result, "attire_warning", None),
    }


@router.post("/evaluate-answer")
async def legacy_evaluate_answer(request: LegacyEvaluateAnswerRequest):
    reference_text = request.expectedKeywords.replace(",", " ")
    semantic = similarity_score(request.transcript, reference_text)
    keywords = [k.strip() for k in request.expectedKeywords.split(",") if k.strip()]
    coverage = keyword_coverage(request.transcript, keywords)
    blended = round(coverage * 0.6 + semantic * 0.4, 1) if keywords else semantic
    return {
        "correctness": blended, "semanticSimilarity": semantic,
        "keywordCoverage": coverage, "wordCount": len(request.transcript.split()),
    }
