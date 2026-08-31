# Research-grade model pipeline

This optional package implements the GPU-oriented parts of the original specification. It is separate because PyTorch, XLM-R, ONNX Runtime, Captum, and TensorRT cannot execute inside a Cloudflare Worker.

## Implemented

- XLM-R sequence classification with LoRA attention adapters
- Train/validation/test JSONL contracts and validation
- Accuracy and macro precision, recall, and F1
- Monte Carlo dropout variance and predictive entropy
- Integrated-gradients token attribution with Captum
- Merged-model ONNX export
- Optional TensorRT FP16 conversion with dynamic shapes

## Zero-cost execution

Use a free Colab or Kaggle GPU session. Availability and limits are controlled by those providers. The included rows only verify the pipeline; replace them with balanced, anonymized, reviewed data before training a real model.

```bash
cd sentiment_analyzer/ml
pip install -r requirements.txt
python -m unittest discover -s tests
python src/train_lora.py --config config.yaml --data-dir data --output-dir artifacts/xlmr-lora
```

## Dataset contract

Each line is one UTF-8 JSON object:

```json
{"text":"The dashboard is fast","label":"positive","language":"en"}
```

Allowed labels are `negative`, `neutral`, and `positive`. Keep user or conversation groups within one split to prevent leakage.

## Monte Carlo dropout

```bash
python src/mc_dropout.py --model artifacts/xlmr-lora --text "The release is fine, I guess" --passes 20
```

Determine review thresholds using validation data; the example configuration is not a production threshold.

## Integrated gradients

```bash
python src/explain.py --model artifacts/xlmr-lora --text "The new search is extremely slow"
```

Attributions explain the model calculation, not real-world causality.

## ONNX and TensorRT

```bash
python src/export_onnx.py --model artifacts/xlmr-lora --output artifacts/onnx
python src/convert_tensorrt.py --onnx artifacts/onnx/model.onnx --engine artifacts/tensorrt/sentiment.plan
```

TensorRT requires a compatible NVIDIA GPU, CUDA, TensorRT, and `trtexec`. It is unavailable in Cloudflare and CPU-only environments.

## Promotion gates

Do not replace the production baseline until the trained model:

1. Uses representative, legally usable data.
2. Beats the deterministic baseline on a held-out test set.
3. Meets per-language and per-class thresholds.
4. Demonstrates useful calibration and review coverage.
5. Passes privacy, bias, latency, memory and cost reviews.
6. Has a compatible deployment target.
