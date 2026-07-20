import assert from "node:assert/strict";
import test from "node:test";
import { validateScoringModel, weightedScore } from "./scoring.ts";

const model: [string, number][] = [["Fit", 40], ["Resources", 60]];

test("missing qualification data receives a rating of one", () => {
  assert.equal(weightedScore(model, {}), 20);
});

test("weighted score respects the inverse resource rating supplied by analysis", () => {
  assert.equal(weightedScore(model, { Fit: 4, Resources: 5 }), 92);
});

test("model validation requires exactly one hundred percent", () => {
  assert.equal(validateScoringModel(model), true);
  assert.equal(validateScoringModel([["Fit", 90]]), false);
});
