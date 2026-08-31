"""Merge LoRA adapters and export the sequence classifier to ONNX."""
from __future__ import annotations
import argparse
from pathlib import Path
from optimum.onnxruntime import ORTModelForSequenceClassification
from peft import AutoPeftModelForSequenceClassification
from transformers import AutoTokenizer

def export(model_path: str, output_path: str):
    output = Path(output_path)
    output.mkdir(parents=True, exist_ok=True)
    adapter = AutoPeftModelForSequenceClassification.from_pretrained(model_path)
    merged = adapter.merge_and_unload()
    merged.save_pretrained(output / "merged")
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    tokenizer.save_pretrained(output)
    onnx_model = ORTModelForSequenceClassification.from_pretrained(output / "merged", export=True)
    onnx_model.save_pretrained(output)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", default="artifacts/onnx")
    args = parser.parse_args()
    export(args.model, args.output)
