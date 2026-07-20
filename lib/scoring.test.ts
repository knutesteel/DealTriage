import assert from "node:assert/strict";
import test from "node:test";
import { clampCategoryPoints, pointScore, validateScoringModel } from "./scoring.ts";

const model: [string, number][] = [["Fit", 40], ["Resources", 60]];

test("missing qualification data receives twenty percent of available points", () => {
  assert.equal(pointScore(model, {}), 20);
});

test("point score uses AI recommendations directly", () => {
  assert.equal(pointScore(model, { Fit: 32, Resources: 60 }), 92);
});

test("manual overrides cannot exceed the category maximum", () => {
  assert.equal(pointScore(model, { Fit: 20, Resources: 40 }, { Resources: 100 }), 80);
  assert.equal(pointScore(model, { Fit: 20, Resources: 40 }, { Resources: 41.6 }), 62);
  assert.deepEqual(clampCategoryPoints(model, { Fit: 100, Resources: -4 }), { Fit: 40, Resources: 0 });
});

test("model validation requires exactly one hundred percent", () => {
  assert.equal(validateScoringModel(model), true);
  assert.equal(validateScoringModel([["Fit", 90]]), false);
});
