export type ScoringCategory = [string, number];

export function validateScoringModel(model: unknown): model is ScoringCategory[] {
  return Array.isArray(model) && model.length > 0 && model.every(item => Array.isArray(item) && typeof item[0] === "string" && Number.isFinite(Number(item[1])) && Number(item[1]) >= 0) && model.reduce((sum, item) => sum + Number(item[1]), 0) === 100;
}

export function clampCategoryPoints(model: ScoringCategory[], points: Record<string, number>) {
  return Object.fromEntries(model.map(([label, maximum]) => {
    const supplied = Number(points[label]);
    return [label, Number.isFinite(supplied) ? Math.min(maximum, Math.max(0, supplied)) : maximum * 0.2];
  }));
}

export function pointScore(model: ScoringCategory[], aiPoints: Record<string, number>, manualPoints: Record<string, number> = {}) {
  const recommended = clampCategoryPoints(model, aiPoints);
  return Math.round(model.reduce((sum, [label, maximum]) => {
    const manual = Number(manualPoints[label]);
    const effective = Number.isFinite(manual) ? Math.min(maximum, Math.max(0, manual)) : recommended[label];
    return sum + effective;
  }, 0));
}
