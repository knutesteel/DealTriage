export type ScoringCategory = [string, number];

export function validateScoringModel(model: unknown): model is ScoringCategory[] {
  return Array.isArray(model) && model.length > 0 && model.every(item => Array.isArray(item) && typeof item[0] === "string" && Number.isFinite(Number(item[1])) && Number(item[1]) >= 0) && model.reduce((sum, item) => sum + Number(item[1]), 0) === 100;
}

export function weightedScore(model: ScoringCategory[], ratings: Record<string, number>) {
  return Math.round(model.reduce((sum, [label, weight]) => {
    const supplied = Number(ratings[label]);
    const rating = Number.isFinite(supplied) && supplied >= 1 ? Math.min(5, supplied) : 1;
    return sum + (rating / 5) * weight;
  }, 0));
}
