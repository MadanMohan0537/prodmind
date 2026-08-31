"""Monte Carlo dropout inference for predictive uncertainty."""
from __future__ import annotations
import argparse, json
import numpy as np
import torch
from peft import AutoPeftModelForSequenceClassification
from transformers import AutoTokenizer

def enable_dropout(model):
    model.eval()
    for module in model.modules():
        if isinstance(module, torch.nn.Dropout):
            module.train()

@torch.no_grad()
def predict_with_uncertainty(model, tokenizer, text: str, passes: int = 20, max_length: int = 256):
    enable_dropout(model)
    device = next(model.parameters()).device
    inputs = {key: value.to(device) for key, value in tokenizer(text, return_tensors="pt", truncation=True, max_length=max_length).items()}
    probabilities = []
    for _ in range(passes):
        probabilities.append(torch.softmax(model(**inputs).logits, dim=-1).cpu().numpy()[0])
    samples = np.stack(probabilities)
    mean = samples.mean(axis=0)
    variance = samples.var(axis=0)
    entropy = float(-(mean * np.log(mean + 1e-12)).sum())
    label_id = int(mean.argmax())
    return {"label": model.config.id2label[label_id], "probabilities": mean.tolist(), "variance": variance.tolist(), "predictive_entropy": entropy, "mc_passes": passes}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--passes", type=int, default=20)
    args = parser.parse_args()
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoPeftModelForSequenceClassification.from_pretrained(args.model, device_map="auto")
    print(json.dumps(predict_with_uncertainty(model, tokenizer, args.text, args.passes), indent=2))
