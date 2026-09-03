import { readFile } from "node:fs/promises";
import { buildDashboard } from "../public/analytics.js";

const path = process.argv[2] || "evaluation/labeled-dashboard.json";
const suite = JSON.parse(await readFile(path, "utf8"));
const results = suite.cases.map(testCase => {
  const result = buildDashboard(testCase.records, testCase.filters);
  const actual = {
    totalFeedback: result.summary.totalFeedback,
    uniqueCustomers: result.summary.uniqueCustomers,
    needsAttention: result.summary.needsAttention,
    topTopic: result.topics[0]?.name,
    topSource: result.sources[0]?.name
  };
  const checks = Object.entries(testCase.expect).map(([key, expected]) => ({ key, expected, actual: actual[key], pass: actual[key] === expected }));
  return { name: testCase.name, pass: checks.every(check => check.pass), checks };
});
console.log(JSON.stringify({ cases: results.length, passed: results.filter(result => result.pass).length, results }, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
