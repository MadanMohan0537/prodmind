"""Integrated-gradients token attribution using Captum."""
from __future__ import annotations
import argparse, json
import torch
from captum.attr import LayerIntegratedGradients
from peft import AutoPeftModelForSequenceClassification
from transformers import AutoTokenizer

def explain(model, tokenizer, text: str, target: int | None = None, max_length: int = 256):
    model.eval()
    device = next(model.parameters()).device
    encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=max_length)
    input_ids, attention_mask = encoded["input_ids"].to(device), encoded["attention_mask"].to(device)
    baseline = torch.full_like(input_ids, tokenizer.pad_token_id)
    baseline[:, 0] = input_ids[:, 0]
    def forward(ids, mask): return model(input_ids=ids, attention_mask=mask).logits
    with torch.no_grad():
        predicted = int(forward(input_ids, attention_mask).argmax(dim=-1).item())
    target = predicted if target is None else target
    embeddings = model.get_input_embeddings()
    attributions = LayerIntegratedGradients(forward, embeddings).attribute(inputs=input_ids, baselines=baseline, additional_forward_args=(attention_mask,), target=target, n_steps=32)
    scores = attributions.sum(dim=-1).squeeze(0)
    scores = scores / (torch.norm(scores) + 1e-12)
    tokens = tokenizer.convert_ids_to_tokens(input_ids.squeeze(0))
    return {"label": model.config.id2label[target], "attributions": [{"token": token, "score": float(score)} for token, score in zip(tokens, scores.cpu())]}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoPeftModelForSequenceClassification.from_pretrained(args.model, device_map="auto")
    print(json.dumps(explain(model, tokenizer, args.text), ensure_ascii=False, indent=2))
