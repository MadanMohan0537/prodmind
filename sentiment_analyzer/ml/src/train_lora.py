"""Fine-tune XLM-R for sentiment with parameter-efficient LoRA adapters."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import yaml
from datasets import Dataset, DatasetDict
from peft import LoraConfig, TaskType, get_peft_model
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from transformers import AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding, Trainer, TrainingArguments, set_seed
from data import label_maps, read_jsonl

def metrics(prediction):
    predictions = np.argmax(prediction.predictions, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(prediction.label_ids, predictions, average="macro", zero_division=0)
    return {"accuracy": accuracy_score(prediction.label_ids, predictions), "macro_precision": precision, "macro_recall": recall, "macro_f1": f1}

def main(config_path: str, data_dir: str, output_dir: str):
    config = yaml.safe_load(Path(config_path).read_text())
    set_seed(config["seed"])
    label_to_id, id_to_label = label_maps()
    tokenizer = AutoTokenizer.from_pretrained(config["model_name"])
    datasets = DatasetDict({split: Dataset.from_list(read_jsonl(Path(data_dir) / f"{split}.jsonl")) for split in ("train", "validation", "test")})

    def tokenize(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=config["max_length"])
        encoded["labels"] = [label_to_id[label] for label in batch["label"]]
        return encoded

    tokenized = datasets.map(tokenize, batched=True, remove_columns=datasets["train"].column_names)
    model = AutoModelForSequenceClassification.from_pretrained(config["model_name"], num_labels=len(label_to_id), id2label=id_to_label, label2id=label_to_id)
    lora = config["lora"]
    model = get_peft_model(model, LoraConfig(task_type=TaskType.SEQ_CLS, r=lora["rank"], lora_alpha=lora["alpha"], lora_dropout=lora["dropout"], target_modules=lora["target_modules"]))
    training = config["training"]
    arguments = TrainingArguments(output_dir=output_dir, num_train_epochs=training["epochs"], learning_rate=training["learning_rate"], per_device_train_batch_size=training["train_batch_size"], per_device_eval_batch_size=training["eval_batch_size"], gradient_accumulation_steps=training["gradient_accumulation_steps"], weight_decay=training["weight_decay"], warmup_ratio=training["warmup_ratio"], eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True, metric_for_best_model="macro_f1", greater_is_better=True, report_to="none", fp16=True)
    trainer = Trainer(model=model, args=arguments, train_dataset=tokenized["train"], eval_dataset=tokenized["validation"], processing_class=tokenizer, data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=metrics)
    trainer.train()
    test_metrics = trainer.evaluate(tokenized["test"], metric_key_prefix="test")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    Path(output_dir, "test_metrics.json").write_text(json.dumps(test_metrics, indent=2))
    print(json.dumps({"trainable_parameters": model.get_nb_trainable_parameters(), "test": test_metrics}, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--output-dir", default="artifacts/xlmr-lora")
    args = parser.parse_args()
    main(args.config, args.data_dir, args.output_dir)
