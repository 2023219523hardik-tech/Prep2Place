"""
Curated skill taxonomy used for rule-based extraction from job descriptions, syllabi, and
resumes. HONEST SCOPE: this is a dictionary/regex approach, not a trained NER model (spaCy /
a fine-tuned transformer would be a strict upgrade — see docs/MODELS.md — but needs a model
download this sandbox can't perform). It is genuine, deterministic, and easy to extend by
editing the lists below; no black box.
"""

SKILL_TAXONOMY: dict[str, list[str]] = {
    "programming_languages": [
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin",
        "swift", "ruby", "php", "scala", "r",
    ],
    "web_backend": [
        "spring boot", "django", "flask", "fastapi", "express", "node.js", "rest api",
        "graphql", "microservices", "grpc",
    ],
    "web_frontend": [
        "react", "next.js", "vue", "angular", "html", "css", "tailwind", "redux",
    ],
    "databases": [
        "sql", "postgresql", "mysql", "mongodb", "redis", "cassandra", "dynamodb", "sqlite",
    ],
    "data_structures_algorithms": [
        "arrays", "linked list", "trees", "graphs", "dynamic programming", "recursion",
        "sorting", "searching", "hashing", "heaps", "greedy algorithms", "big o notation",
    ],
    "cloud_devops": [
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "jenkins",
        "github actions",
    ],
    "data_ml": [
        "machine learning", "deep learning", "pandas", "numpy", "scikit-learn", "tensorflow",
        "pytorch", "nlp", "computer vision", "data analysis", "statistics",
    ],
    "soft_skills": [
        "communication", "leadership", "teamwork", "problem solving", "time management",
    ],
}

ALL_SKILLS: list[str] = [skill for skills in SKILL_TAXONOMY.values() for skill in skills]


def category_for(skill: str) -> str | None:
    skill_lower = skill.lower().strip()
    for category, skills in SKILL_TAXONOMY.items():
        if skill_lower in skills:
            return category
    return None
