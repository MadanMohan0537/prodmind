"""Vocabulary drift utilities with no third-party dependencies."""
import math
from collections import Counter


def distribution(documents):
    counts = Counter(word.lower() for text in documents for word in text.split())
    total = sum(counts.values()) or 1
    return {word: count / total for word, count in counts.items()}


def kl_divergence(previous, current, smoothing=1e-6):
    terms = set(previous) | set(current)
    return max(0.0, sum(((current.get(term, 0) + smoothing) * math.log((current.get(term, 0) + smoothing) / (previous.get(term, 0) + smoothing))) for term in terms))


def detect_drift(previous_documents, current_documents, moderate=0.35, high=1.0):
    score = kl_divergence(distribution(previous_documents), distribution(current_documents))
    level = "high" if score >= high else "moderate" if score >= moderate else "stable"
    return {"score": round(score, 4), "level": level}
