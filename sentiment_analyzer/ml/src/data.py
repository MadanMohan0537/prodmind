"""Dataset validation and loading utilities."""
from __future__ import annotations
import json
from pathlib import Path

LABELS = ("negative", "neutral", "positive")

def read_jsonl(path: str | Path) -> list[dict]:
    rows = []
    with Path(path).open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            errors = validate_row(row)
            if errors:
                raise ValueError(f"{path}:{line_number}: {', '.join(errors)}")
            rows.append(row)
    if not rows:
        raise ValueError(f"{path}: dataset is empty")
    return rows

def validate_row(row: dict) -> list[str]:
    errors = []
    if not isinstance(row, dict):
        return ["row must be an object"]
    if not isinstance(row.get("text"), str) or not row["text"].strip():
        errors.append("text must be a non-empty string")
    if row.get("label") not in LABELS:
        errors.append(f"label must be one of {LABELS}")
    if not isinstance(row.get("language"), str) or not row["language"]:
        errors.append("language is required")
    return errors

def label_maps() -> tuple[dict[str, int], dict[int, str]]:
    label_to_id = {label: index for index, label in enumerate(LABELS)}
    return label_to_id, {index: label for label, index in label_to_id.items()}
