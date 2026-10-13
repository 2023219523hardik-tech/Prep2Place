"""
Real NLP scoring using scikit-learn TF-IDF + cosine similarity — the same tested logic from
the previous iteration. A genuine (if classical, non-transformer) ML technique; no downloaded
model weights needed. `sentence-transformers`-based semantic embeddings would be a strict
upgrade here (see docs/MODELS.md) but require downloading a model this sandbox can't fetch.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def similarity_score(text_a: str, text_b: str) -> float:
    text_a, text_b = (text_a or "").strip(), (text_b or "").strip()
    if not text_a or not text_b:
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        tfidf = vectorizer.fit_transform([text_a, text_b])
    except ValueError:
        return 0.0
    sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    return round(float(max(0.0, min(1.0, sim))) * 100, 1)


def keyword_coverage(text: str, keywords: list[str]) -> float:
    if not keywords:
        return 0.0
    lower = (text or "").lower()
    matched = sum(1 for k in keywords if k.lower().strip() in lower)
    return round((matched / len(keywords)) * 100, 1)


def rank_by_similarity(query: str, candidates: list[str]) -> list[tuple[int, float]]:
    """Returns (original_index, score) pairs sorted by similarity to `query`, descending.
    Used by the resource-ranking and roadmap-ordering logic below."""
    scored = [(i, similarity_score(query, c)) for i, c in enumerate(candidates)]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)
