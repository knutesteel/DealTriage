import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { clampCategoryPoints, pointScore, validateScoringModel } from "../../../lib/scoring";

const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const systemPrompt = `You are Ilma's Route to Revenue, an enterprise opportunity qualification analyst. Score only from provided evidence. scoringModel supplies each category name and its maximum points; all maximums total 100. Return AI-recommended points for every category between 0 and that category's maximum. MISSING-DATA RULE: if no category-specific qualification evidence is present, award exactly 20% of that category's maximum points. Never infer higher points from opportunity amount, stage, name, or generic metadata alone. Resource Requirements is a 20-point inverse-scored category: explicit evidence of low delivery, implementation, services, support, and internal effort earns high points; very high resource demand or missing resource evidence earns 4 points. If opportunity includes manualCategoryPoints, each supplied value is a user override and must be capped at the category maximum. Use the override for overallScore while retaining your AI-recommended points in categoryScores. qualificationNotes are current evidence. overallScore is the sum of effective category points, capped at 100. Return valid JSON with overallScore (0-100), tier (Hot|Work|Nurture|Deprioritize), confidence (High|Medium|Low), rationale, flags, and categoryScores. Each category score must have points, rationale, evidence, missingInformation, and hardStop.`;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 250_000) return NextResponse.json({ error: "Scoring request is too large." }, { status: 413 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const now = Date.now(); const recent = (requests.get(userId) || []).filter(time => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return NextResponse.json({ error: "Scoring rate limit reached. Try again in one minute." }, { status: 429 });
  recent.push(now); requests.set(userId, recent);
  let body: { opportunity?: Record<string, unknown>; scoringModel?: unknown[][] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const { opportunity, scoringModel } = body;
  if (!opportunity || typeof opportunity !== "object" || !Array.isArray(scoringModel) || scoringModel.length < 1) return NextResponse.json({ error: "Opportunity and scoring model are required." }, { status: 400 });
  if (!validateScoringModel(scoringModel)) return NextResponse.json({ error: "Scoring model weights must be valid and total 100%." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI scoring is not configured. Add OPENAI_API_KEY to the deployment environment." }, { status: 503 });
  }
  const maximumByCategory = Object.fromEntries(scoringModel.map(([label, maximum]) => [String(label), Number(maximum)]));
  const rawManual = opportunity.manualCategoryPoints && typeof opportunity.manualCategoryPoints === "object" ? opportunity.manualCategoryPoints as Record<string, number> : {};
  const manualCategoryPoints = Object.fromEntries(Object.entries(rawManual).flatMap(([label, value]) => label in maximumByCategory && Number.isFinite(Number(value)) ? [[label, Math.min(maximumByCategory[label], Math.max(0, Math.round(Number(value))))]] : []));
  const safeOpportunity = { ...opportunity, manualCategoryPoints };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      instructions: systemPrompt,
      input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ opportunity: safeOpportunity, scoringModel }) }] }],
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "opportunity_score",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["overallScore", "tier", "confidence", "rationale", "flags", "categoryScores"],
            properties: {
              overallScore: { type: "number" },
              tier: { type: "string", enum: ["Hot", "Work", "Nurture", "Deprioritize"] },
              confidence: { type: "string", enum: ["High", "Medium", "Low"] },
              rationale: { type: "string" },
              flags: { type: "array", items: { type: "string" } },
              categoryScores: { type: "array", items: { type: "object", additionalProperties: false, required: ["category", "points", "rationale", "evidence", "missingInformation", "hardStop"], properties: { category: { type: "string" }, points: { type: "number", minimum: 0, maximum: 100 }, rationale: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, missingInformation: { type: "array", items: { type: "string" } }, hardStop: { type: "boolean" } } } }
            }
          }
        }
      }
    })
  });
  if (!response.ok) return NextResponse.json({ error: "AI scoring failed", requestId: response.headers.get("x-request-id") }, { status: response.status });
  const data = await response.json();
  const text = data.output_text;
  if (!text) return NextResponse.json({ error: "AI scoring returned no result." }, { status: 502 });
  try {
    const result = JSON.parse(text) as { overallScore: number; tier: string; confidence: string; rationale: string; flags: string[]; categoryScores: Array<{ category: string; points: number; rationale: string; evidence: string[]; missingInformation: string[]; hardStop: boolean }> };
    const returned = Object.fromEntries((result.categoryScores || []).map(item => [item.category, item]));
    const recommended = clampCategoryPoints(scoringModel, Object.fromEntries(scoringModel.map(([label]) => [String(label), Number(returned[String(label)]?.points)])));
    const categoryScores = scoringModel.map(([rawLabel, rawMaximum]) => {
      const category = String(rawLabel); const item = returned[category];
      return { category, points: recommended[category], rationale: item?.rationale || "No category-specific evidence was provided.", evidence: item?.evidence || [], missingInformation: item?.missingInformation || [], hardStop: Boolean(item?.hardStop), maximumPoints: Number(rawMaximum) };
    });
    const overallScore = pointScore(scoringModel, recommended, manualCategoryPoints);
    return NextResponse.json({ ...result, overallScore, tier: overallScore >= 80 ? "Hot" : overallScore >= 60 ? "Work" : overallScore >= 40 ? "Nurture" : "Deprioritize", categoryScores });
  } catch { return NextResponse.json({ error: "AI scoring returned an invalid result." }, { status: 502 }); }
}
