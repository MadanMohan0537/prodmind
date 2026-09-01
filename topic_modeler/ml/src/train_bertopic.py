"""Train BERTopic and export portable topic metadata."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="JSONL containing a text field")
    parser.add_argument("--output", default="artifacts/topics.json")
    parser.add_argument("--embedding-model", default="all-MiniLM-L6-v2")
    args = parser.parse_args()
    from bertopic import BERTopic
    from sentence_transformers import SentenceTransformer

    rows = [json.loads(line) for line in Path(args.input).read_text().splitlines() if line.strip()]
    texts = [row["text"] for row in rows]
    embeddings = SentenceTransformer(args.embedding_model).encode(texts, show_progress_bar=True)
    model = BERTopic(min_topic_size=2, calculate_probabilities=True)
    topics, probabilities = model.fit_transform(texts, embeddings)
    output = {"topics": model.get_topic_info().to_dict(orient="records"), "assignments": topics, "probabilities": probabilities.tolist() if probabilities is not None else None}
    destination = Path(args.output); destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, indent=2))
    model.save(destination.parent / "bertopic_model", serialization="safetensors", save_ctfidf=True)


if __name__ == "__main__":
    main()
