import { NextResponse } from "next/server";

const systemPrompt = `You are Ilma's Route to Revenue, an enterprise opportunity qualification analyst. Score only from provided evidence. If the opportunity includes manualCategoryRatings or qualificationNotes, treat them as the seller's newest qualification evidence: use each manual rating as the requested category rating, weigh the notes in your rationale, and recalculate the overall score accordingly. Return valid JSON with overallScore (0-100), tier (Hot|Work|Nurture|Deprioritize), confidence (High|Medium|Low), rationale, flags, and categoryScores. Each category score must have rating (1-5), rationale, evidence, missingInformation, and hardStop. Be conservative when evidence is missing.`;

export async function POST(request: Request) {
  const { opportunity, scoringModel } = await request.json();
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI scoring is not configured. Add OPENAI_API_KEY to the deployment environment." }, { status: 503 });
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      instructions: systemPrompt,
      input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ opportunity, scoringModel }) }] }],
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
              categoryScores: { type: "array", items: { type: "object", additionalProperties: false, required: ["category", "rating", "rationale", "evidence", "missingInformation", "hardStop"], properties: { category: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, rationale: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, missingInformation: { type: "array", items: { type: "string" } }, hardStop: { type: "boolean" } } } }
            }
          }
        }
      }
    })
  });
  if (!response.ok) return NextResponse.json({ error: "AI scoring failed", detail: await response.text() }, { status: response.status });
  const data = await response.json();
  const text = data.output_text;
  return NextResponse.json(JSON.parse(text));
}
