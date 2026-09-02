import fs from "node:fs";
import { detectIntents } from "../public/detector.js";

export function evaluateDataset(rows) {
  const labels = ["feature-request", "bug-report", "complaint", "praise", "question", "churn-risk"];
  const metrics = Object.fromEntries(labels.map(label => [label, { truePositive: 0, falsePositive: 0, falseNegative: 0 }]));
  const predictions = rows.map(row => {
    const predicted = new Set(detectIntents(row.text).intents.map(intent => intent.label));
    const expected = new Set(row.labels);
    for (const label of labels) {
      if (predicted.has(label) && expected.has(label)) metrics[label].truePositive += 1;
      else if (predicted.has(label)) metrics[label].falsePositive += 1;
      else if (expected.has(label)) metrics[label].falseNegative += 1;
    }
    return { text: row.text, expected: [...expected], predicted: [...predicted] };
  });
  for (const value of Object.values(metrics)) {
    value.precision = value.truePositive / (value.truePositive + value.falsePositive || 1);
    value.recall = value.truePositive / (value.truePositive + value.falseNegative || 1);
    value.f1 = 2 * value.precision * value.recall / (value.precision + value.recall || 1);
  }
  const exactMatch = predictions.filter(item => JSON.stringify([...item.expected].sort()) === JSON.stringify([...item.predicted].sort())).length / (rows.length || 1);
  return { records: rows.length, exactMatch: Number(exactMatch.toFixed(4)), labels: metrics, mismatches: predictions.filter(item => JSON.stringify([...item.expected].sort()) !== JSON.stringify([...item.predicted].sort())) };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const rows = JSON.parse(fs.readFileSync(process.argv[2] || "evaluation/labeled-feedback.json", "utf8"));
  console.log(JSON.stringify(evaluateDataset(rows), null, 2));
}
