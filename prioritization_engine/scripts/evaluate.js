import { readFile } from "node:fs/promises";
import { prioritize } from "../public/engine.js";

const path = process.argv[2] || "evaluation/labeled-opportunities.json";
const suite = JSON.parse(await readFile(path, "utf8"));
const results = suite.cases.map(testCase => {
  const output = prioritize(testCase.opportunities, testCase.options);
  const checks = [];
  if (testCase.expectedTop) checks.push({ name: "top", expected: testCase.expectedTop, actual: output.ranked[0]?.id, pass: output.ranked[0]?.id === testCase.expectedTop });
  if (testCase.expectedSelected) checks.push({ name: "selected", expected: testCase.expectedSelected, actual: output.portfolio.selected, pass: JSON.stringify(output.portfolio.selected) === JSON.stringify(testCase.expectedSelected) });
  return { name: testCase.name, passed: checks.every(check => check.pass), checks };
});
const report = { cases: results.length, passed: results.filter(result => result.passed).length, results };
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.cases) process.exitCode = 1;
