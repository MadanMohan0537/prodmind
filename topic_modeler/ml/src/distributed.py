"""Optional Dask preprocessing for corpora too large for one process."""
import re


def clean_text(text):
    return re.sub(r"\s+", " ", str(text)).strip()


def preprocess_jsonl(path, partition_size="64MB"):
    import dask.bag as db
    import json
    return db.read_text(path, blocksize=partition_size).map(json.loads).map(lambda row: {**row, "text": clean_text(row["text"])}).compute()
