"""Time-decayed and source-reliability-weighted class TF-IDF."""
import math
from collections import Counter
from datetime import datetime, timezone


def weight(timestamp, reliability=1.0, half_life_days=30, now=None):
    now = now or datetime.now(timezone.utc)
    moment = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    age_days = max(0, (now - moment).total_seconds() / 86400)
    return max(0, min(1, reliability)) * (0.5 ** (age_days / half_life_days))


def weighted_terms(records, all_records, limit=10, half_life_days=30):
    document_frequency = Counter(word for record in all_records for word in set(record["text"].lower().split()))
    scores = Counter()
    now = max(datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")) for item in all_records)
    for record in records:
        record_weight = weight(record["timestamp"], record.get("reliability", 1), half_life_days, now)
        for term in record["text"].lower().split():
            scores[term] += record_weight * math.log(1 + len(all_records) / document_frequency[term])
    return scores.most_common(limit)
