import { readFile } from "node:fs/promises";
import { analyzeSentiment } from "../public/analyzer.js";

const LABELS = ["positive", "neutral", "negative"];

function emptyConfusionMatrix() {
  return Object.fromEntries(
    LABELS.map(actual => [actual, Object.fromEntries(LABELS.map(predicted => [predicted, 0]))])
  );
}

function calculatePerLabel(confusion) {
  return Object.fromEntries(LABELS.map(label => {
    const truePositive = confusion[label][label];
    const falsePositive = LABELS
      .filter(actual => actual !== label)
      .reduce((sum, actual) => sum + confusion[actual][label], 0);
    const falseNegative = LABELS
      .filter(predicted => predicted !== label)
      .reduce((sum, predicted) => sum + confusion[label][predicted], 0);
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    const recall = truePositive / Math.max(1, truePositive + falseNegative);
    const f1 = 2 * precision * recall / Math.max(0.0001, precision + recall);
    return [label, { precision, recall, f1 }];
  }));
}

export function evaluateDataset(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new TypeError("evaluation dataset must be a non-empty array");
  const confusion = emptyConfusionMatrix();
  const errors = [];
  let correct = 0;
  let brierTotal = 0;

  for (const row of rows) {
    if (!LABELS.includes(row.label)) throw new TypeError(`unsupported evaluation label: ${row.label}`);
    const result = analyzeSentiment(row.text, { language: row.language });
    confusion[row.label][result.label] += 1;
    if (result.label === row.label) correct += 1;
    else errors.push({ text: row.text, expected: row.label, predicted: result.label, confidence: result.confidence });
    const assignedToCorrectClass = result.label === row.label ? result.confidence : 1 - result.confidence;
    brierTotal += (assignedToCorrectClass - 1) ** 2;
  }

  return {
    samples: rows.length,
    accuracy: correct / rows.length,
    brierScore: brierTotal / rows.length,
    confusion,
    perLabel: calculatePerLabel(confusion),
    errors
  };
}

if (process.argv[1]?.endsWith("evaluate.js")) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node scripts/evaluate.js <labeled-dataset.json>");
  const rows = JSON.parse(await readFile(path, "utf8"));
  console.log(JSON.stringify(evaluateDataset(rows), null, 2));
}
