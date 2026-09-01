# Optional BERTopic research pipeline

This package is the high-fidelity experimentation layer. It is intentionally separate from the Cloudflare Worker: BERTopic, transformer embeddings, River, and Dask do not run inside a standard Worker. Use this package on your computer or a free notebook, then publish only compact topic metadata to the application.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/train_bertopic.py data/sample.jsonl
python -m unittest discover -s tests
```

Components:

- `train_bertopic.py`: sentence-transformer embeddings and BERTopic training/export
- `online_topics.py`: River K-Means updates one embedding at a time
- `hierarchy.py`: BERTopic hierarchical topic export
- `weighted_ctfidf.py`: time decay and source-reliability weighting
- `drift.py`: KL-divergence drift score between windows
- `distributed.py`: optional Dask JSONL preprocessing

The first model download needs internet access and disk space. No paid API is required, but local training still consumes your own CPU/GPU time.
