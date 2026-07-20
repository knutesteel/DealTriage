"use client";

import "./manual.css";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpRight, Bot, ChevronDown, CircleAlert, Filter,
  LogOut, MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, Sparkles,
  Upload, X
} from "lucide-react";
import { createClient } from "../lib/supabase/client";

type Tier = "Hot" | "Work" | "Nurture" | "Deprioritize";
type Opportunity = {
  dbId?: string;
  id: string; name: string; account: string; score: number; tier: Tier; amount: number;
  closeDate: string; stage: string; forecast: string; owner: string; source: string;
  partner: string; nextStep: string; nextStepDate: string; changed: number;
  confidence: "High" | "Medium" | "Low"; flags?: string[];
  dealData?: DealData; analysis?: ScoreAnalysis;
  lifecycle?: "active" | "archived" | "closed_won" | "closed_lost";
  updatedAt?: string; lastScoredAt?: string; history?: ScoreHistory[];
};

type DealData = Record<string, string>;
type CategoryAnalysis = { points: number; rationale: string; evidence: string[]; missingInformation: string[]; hardStop: boolean };
type ScoreAnalysis = { rationale: string; categoryScores: Record<string, CategoryAnalysis> };
type ScoreHistory = { id: string; overall_score: number; tier: Tier; confidence: string; result: Record<string, unknown>; created_at: string; trigger: string; model_version: number };
type ActivityLog = { id: string; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; detail: Record<string, unknown>; created_at: string };

function sampleQualification(account: string, partner: string, base: number): DealData {
  const points = (maximum: number, offset = 0) => String(Math.round((Math.max(1, Math.min(5, base + offset)) / 5) * maximum * 10) / 10);
  const strong = base >= 4; const developing = base === 3;
  return {
    "qualification:Ideal Customer Fit": strong ? `${account} is a large public-sector organization with formal security, compliance, and vendor-risk obligations.` : developing ? `${account} matches the target public-sector segment, but deployment scope and affected departments are still being validated.` : `${account} is in the target market, but organization size, compliance maturity, and use-case fit are not yet confirmed.`, "aiPoints:Ideal Customer Fit": points(8),
    "qualification:Pain And Urgency": strong ? "The current manual compliance process is delaying audits and consuming significant staff time; leadership has asked for a remedy this quarter." : developing ? "The customer acknowledges audit-preparation delays, but the operational impact and urgency have not been quantified." : "General interest has been expressed, but no measurable business pain or urgent consequence has been documented.", "aiPoints:Pain And Urgency": points(10, strong ? 0 : -1),
    "qualification:Executive Sponsor": strong ? "An accountable executive sponsor is identified, actively engaged, and scheduled for the decision review." : developing ? "A credible champion is engaged and has offered to introduce an executive sponsor, but direct access is pending." : "No executive sponsor or reliable path to executive sponsorship has been established.", "aiPoints:Executive Sponsor": points(8, strong ? 0 : -1),
    "qualification:Budget And Funding Confidence": strong ? "Funding is allocated in the current fiscal year and the customer has confirmed the expected purchase range." : developing ? "A likely funding source has been identified, but final allocation and approval are still pending." : "No approved budget or confirmed funding source has been identified.", "aiPoints:Budget And Funding Confidence": points(10, strong ? 0 : -1),
    "qualification:Timing / Compelling Event": strong ? "The customer must complete implementation before its fiscal-year audit and contract-renewal deadline." : developing ? "The customer is targeting this fiscal year, but no immovable deadline has been confirmed." : "There is no documented deadline, mandate, renewal, audit, or other compelling event.", "aiPoints:Timing / Compelling Event": points(8, strong ? 0 : -1),
    "qualification:Solution Fit": strong ? "The proposed platform directly addresses the documented workflow and technical requirements." : developing ? "The primary use case appears aligned, but technical requirements still require discovery." : "The customer has not confirmed required capabilities or technical fit.", "aiPoints:Solution Fit": points(4),
    "qualification:Value Proposition": strong ? "The customer has validated measurable reductions in audit preparation, evidence collection, and operational effort." : developing ? "Expected benefits are understood, but measurable business value has not been validated." : "No quantified value proposition or expected customer outcome has been documented.", "aiPoints:Value Proposition": points(4),
    "qualification:Engagement / Activity": strong ? "The customer has attended discovery and technical sessions, shared requirements, and responded to follow-up within two business days." : developing ? "The customer attended an initial discovery call and opened follow-up material, but responses have been intermittent." : "Cold inbound lead. The customer has not responded to outreach or completed a discovery meeting.", "aiPoints:Engagement / Activity": points(6, strong ? 0 : -1),
    "qualification:Procurement Path": strong ? "The contract vehicle, procurement owner, legal review, security review, and target award process are documented." : developing ? "Procurement has been identified, but the contract vehicle and security-review timeline are still being mapped." : "No procurement contact, contract vehicle, approval sequence, or acquisition timeline is known.", "aiPoints:Procurement Path": points(6, strong ? 0 : -1),
    "qualification:Competitive Position": strong ? "The customer has positioned the solution as the preferred option based on automation and public-sector workflow fit." : developing ? "Two alternatives are under review; differentiation is understood, but preference has not been established." : "The incumbent and competing alternatives are unknown, and no differentiation has been validated with the customer.", "aiPoints:Competitive Position": points(4),
    "qualification:Strategic Value": strong ? "A successful initial deployment can expand across additional agencies, departments, and adjacent compliance workflows." : developing ? "There is a plausible second-department expansion path, but no executive expansion plan exists yet." : "The opportunity currently appears limited to a small single-use deployment with no confirmed expansion path.", "aiPoints:Strategic Value": points(7),
    "qualification:Existing Relationships": strong ? "The account team has trusted relationships with the security sponsor, procurement lead, and an executive stakeholder." : developing ? "One prior relationship exists with the project champion; broader account relationships are still developing." : "There are no established customer relationships beyond the original lead contact.", "aiPoints:Existing Relationships": points(5, strong ? 0 : -1),
    "qualification:Resource Requirements": strong ? "Standard configuration with limited services: approximately 20 implementation hours and normal customer-success coverage." : developing ? "Moderate implementation support is expected, including workflow configuration, training, and approximately 60 services hours." : "The likely scope requires custom integration, extensive services, and significant ongoing technical support.", "aiPoints:Resource Requirements": points(20, strong ? 0 : developing ? -1 : 0)
  };
}

const seed: Opportunity[] = [
  { id: "006A000001", name: "Enterprise Compliance Platform", account: "State of Colorado", score: 91, tier: "Hot", amount: 420000, closeDate: "Sep 30, 2026", stage: "Proposal", forecast: "Commit", owner: "Ilma Choi", source: "Partner", partner: "Carahsoft", nextStep: "Confirm final security language", nextStepDate: "Aug 8", changed: 6, confidence: "High", dealData: sampleQualification("State of Colorado", "Carahsoft", 5) },
  { id: "006A000002", name: "Trust Management Expansion", account: "City of Austin", score: 84, tier: "Hot", amount: 185000, closeDate: "Aug 31, 2026", stage: "Negotiation", forecast: "Best Case", owner: "Ilma Choi", source: "Outbound", partner: "—", nextStep: "Economic buyer review", nextStepDate: "Aug 5", changed: 4, confidence: "High", dealData: sampleQualification("City of Austin", "—", 4) },
  { id: "006A000003", name: "Security Automation Program", account: "University of Michigan", score: 72, tier: "Work", amount: 250000, closeDate: "Nov 15, 2026", stage: "Discovery", forecast: "Pipeline", owner: "C. Morris", source: "Event", partner: "Deloitte", nextStep: "Map procurement vehicle", nextStepDate: "Aug 13", changed: -3, confidence: "Medium", flags: ["No procurement path"], dealData: sampleQualification("University of Michigan", "Deloitte", 3) },
  { id: "006A000004", name: "Vendor Risk Management", account: "Harris County", score: 66, tier: "Work", amount: 148000, closeDate: "Dec 18, 2026", stage: "Qualification", forecast: "Pipeline", owner: "Ilma Choi", source: "Inbound", partner: "—", nextStep: "Validate funding source", nextStepDate: "Aug 11", changed: 2, confidence: "Medium", flags: ["Budget not confirmed"], dealData: sampleQualification("Harris County", "—", 3) },
  { id: "006A000005", name: "Continuous Compliance Pilot", account: "Commonwealth of Virginia", score: 53, tier: "Nurture", amount: 95000, closeDate: "Jan 30, 2027", stage: "Discovery", forecast: "Pipeline", owner: "A. Patel", source: "Partner", partner: "Guidehouse", nextStep: "Schedule technical discovery", nextStepDate: "Aug 20", changed: 0, confidence: "Low", flags: ["No compelling event"], dealData: sampleQualification("Commonwealth of Virginia", "Guidehouse", 2) },
  { id: "006A000006", name: "Public Sector Risk Program", account: "City of Phoenix", score: 32, tier: "Deprioritize", amount: 120000, closeDate: "Mar 31, 2027", stage: "Prospecting", forecast: "Pipeline", owner: "Ilma Choi", source: "Outbound", partner: "—", nextStep: "Reconnect after budget cycle", nextStepDate: "Oct 1", changed: -5, confidence: "Low", flags: ["No buyer access", "Stale next step"], dealData: sampleQualification("City of Phoenix", "—", 1) }
];

const categories = [
  ["Ideal Customer Fit", 8], ["Pain And Urgency", 10], ["Executive Sponsor", 8],
  ["Budget And Funding Confidence", 10], ["Timing / Compelling Event", 8], ["Solution Fit", 4],
  ["Value Proposition", 4], ["Engagement / Activity", 6], ["Procurement Path", 6],
  ["Competitive Position", 4], ["Strategic Value", 7], ["Existing Relationships", 5],
  ["Resource Requirements", 20]
];

const salesforceFields = [
  ["Opportunity Name", "name", "Required"], ["Salesforce Opportunity ID", "salesforceId", "Optional for a new deal"],
  ["Account Name", "account", "Required"], ["Salesforce Account ID", "accountId", ""],
  ["Primary Contact", "primaryContact", ""], ["Contact ID", "contactId", ""],
  ["Amount", "amount", "USD"], ["Close Date", "closeDate", ""],
  ["Stage", "stage", ""], ["Probability", "probability", "%"],
  ["Forecast Category", "forecast", ""], ["Type", "type", ""], ["Lead Source", "source", ""],
  ["Owner", "owner", ""], ["Campaign", "campaign", ""], ["Partner / Reseller", "partner", ""],
  ["Next Step", "nextStep", ""], ["Next Step Date", "nextStepDate", ""], ["Description", "description", ""]
] as const;

const qualificationFields = categories.map(([label]) => [String(label), `qualification:${String(label)}`] as const);
const defaultPoints = () => Object.fromEntries(categories.map(([label]) => [String(label), ""]));
const defaultDealData = (): DealData => Object.fromEntries(salesforceFields.map(([, key]) => [key, ""]));

const legacyNames: Record<string, string[]> = {
  "Ideal Customer Fit": ["Ideal customer fit"], "Pain And Urgency": ["Pain and urgency"],
  "Executive Sponsor": ["Buying authority / access"], "Budget And Funding Confidence": ["Budget and funding confidence"],
  "Timing / Compelling Event": ["Timing / compelling event"], "Solution Fit": ["Solution fit and expected value"],
  "Value Proposition": ["Solution fit and expected value"], "Engagement / Activity": ["Engagement / activity"],
  "Procurement Path": ["Procurement path / feasibility"], "Competitive Position": ["Competitive position"],
  "Strategic Value": ["Strategic value / expansion"], "Existing Relationships": ["Existing relationships"],
  "Resource Requirements": ["Resource requirements"]
};

function normalizeOpportunity(opportunity: Opportunity): Opportunity {
  const dealData = { ...(opportunity.dealData || {}) };
  const oldScores = opportunity.analysis?.categoryScores || {};
  const categoryScores: Record<string, CategoryAnalysis> = {};
  categories.forEach(([rawLabel, rawMaximum]) => {
    const label = String(rawLabel); const maximum = Number(rawMaximum); const legacy = legacyNames[label] || [];
    if (!dealData[`qualification:${label}`]) for (const old of legacy) if (dealData[`qualification:${old}`]) { dealData[`qualification:${label}`] = dealData[`qualification:${old}`]; break; }
    const current = oldScores[label] as CategoryAnalysis | undefined;
    const old = legacy.map(name => oldScores[name] as (CategoryAnalysis & { rating?: number }) | undefined).find(Boolean);
    const legacyRating = Number(dealData[`rating:${legacy[0]}`] || old?.rating);
    const aiPoints = current?.points ?? (Number.isFinite(legacyRating) ? Math.round((legacyRating / 5) * maximum * 10) / 10 : Number(dealData[`aiPoints:${label}`]));
    if (Number.isFinite(aiPoints)) dealData[`aiPoints:${label}`] = String(Math.min(maximum, Math.max(0, aiPoints)));
    if (current || old) categoryScores[label] = { points: Math.min(maximum, Math.max(0, Number(aiPoints) || maximum * .2)), rationale: current?.rationale || old?.rationale || "", evidence: current?.evidence || old?.evidence || [], missingInformation: current?.missingInformation || old?.missingInformation || [], hardStop: current?.hardStop || old?.hardStop || false };
  });
  return { ...opportunity, dealData, analysis: opportunity.analysis ? { ...opportunity.analysis, categoryScores } : undefined };
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const tierFromScore = (score: number): Tier => score >= 80 ? "Hot" : score >= 60 ? "Work" : score >= 40 ? "Nurture" : "Deprioritize";

function scoreFromRow(row: Record<string, string>, index: number): Opportunity {
  const pick = (...names: string[]) => names.map(n => row[n] ?? row[n.toLowerCase()] ?? "").find(Boolean) || "";
  const amount = Number(pick("Amount").replace(/[^0-9.-]/g, "")) || 0;
  const stage = pick("Stage", "StageName") || "Qualification";
  const description = `${pick("Description")} ${pick("Next Step", "NextStep")} ${pick("Budget Status", "Budget")}`.toLowerCase();
  let score = 48 + (amount >= 100000 ? 10 : 3) + (stage.includes("Proposal") || stage.includes("Negotiation") ? 15 : 0);
  if (description.includes("budget") || description.includes("fund")) score += 8;
  if (description.includes("partner")) score += 4;
  if (description.includes("urgent") || description.includes("deadline")) score += 7;
  score = Math.max(20, Math.min(95, score + ((index * 7) % 11) - 5));
  const resourceText = `${pick("Resource Requirements", "Resource Needs", "Implementation Effort", "Delivery Effort", "Services Required")}`.toLowerCase();
  const resourceRating = /low|minimal|light|self.?serve/.test(resourceText) ? 5 : 1;
  score = Math.round((score * .8) + ((resourceRating / 5) * 20));
  const hasQualificationEvidence = Boolean(`${description} ${resourceText} ${pick("Competition", "Procurement Path", "Economic Buyer", "Compelling Event", "Existing Relationship")}`.trim());
  if (!hasQualificationEvidence) score = 20;
  const flags = score < 60 ? ["Budget not confirmed"] : undefined;
  const dealData: DealData = { ...row, name: pick("Opportunity Name", "Name"), account: pick("Account Name", "Account"), amount: String(amount), stage, closeDate: pick("Close Date", "CloseDate"), owner: pick("Opportunity Owner", "Owner"), source: pick("Lead Source", "LeadSource"), partner: pick("Partner", "Reseller"), nextStep: pick("Next Step", "NextStep"), description: pick("Description") };
  const aliases: Record<string, string[]> = {
    "Ideal Customer Fit": ["Ideal Customer Fit", "ICP Fit"], "Pain And Urgency": ["Pain and Urgency", "Business Pain"],
    "Executive Sponsor": ["Executive Sponsor", "Buying Authority", "Economic Buyer"], "Budget And Funding Confidence": ["Budget Status", "Budget", "Funding Confidence"],
    "Timing / Compelling Event": ["Compelling Event", "Timing"], "Solution Fit": ["Solution Fit"], "Value Proposition": ["Value Proposition", "Expected Value"],
    "Engagement / Activity": ["Engagement Activity", "Activity"], "Procurement Path": ["Procurement Path", "Procurement"],
    "Competitive Position": ["Competition", "Competitive Position"], "Strategic Value": ["Strategic Value", "Expansion Potential"],
    "Existing Relationships": ["Existing Relationship", "Existing Relationships"],
    "Resource Requirements": ["Resource Requirements", "Resource Needs", "Implementation Effort", "Delivery Effort", "Services Required"]
  };
  Object.entries(aliases).forEach(([label, names]) => { dealData[`qualification:${label}`] = pick(...names); });
  return {
    id: pick("Opportunity ID", "Id", "ID") || `import-${index + 1}`,
    name: pick("Opportunity Name", "Name") || `Imported opportunity ${index + 1}`,
    account: pick("Account Name", "Account") || "Unmapped account", score, tier: tierFromScore(score), amount,
    closeDate: pick("Close Date", "CloseDate") || "Not provided", stage,
    forecast: pick("Forecast Category", "ForecastCategoryName") || "Pipeline",
    owner: pick("Opportunity Owner", "Owner") || "Unassigned", source: pick("Lead Source", "LeadSource") || "—",
    partner: pick("Partner", "Reseller") || "—", nextStep: pick("Next Step", "NextStep") || "Validate qualification",
    nextStepDate: pick("Next Step Date") || "—", changed: 0, confidence: score >= 75 ? "High" : "Medium", flags, dealData
  };
}

function parseCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).map(line => {
    const output: string[] = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i++; } else quoted = !quoted; } else if (char === "," && !quoted) { output.push(current.trim()); current = ""; } else current += char; }
    output.push(current.trim()); return output;
  });
  const headers = rows.shift() || []; return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

export default function Dashboard({ userEmail }: { userEmail: string }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(seed.map(normalizeOpportunity));
  const [query, setQuery] = useState(""); const [tier, setTier] = useState<"All" | Tier>("All");
  const [stageFilter, setStageFilter] = useState("All"); const [ownerFilter, setOwnerFilter] = useState("All");
  const [currentModel, setCurrentModel] = useState(categories);
  const [lifecycleFilter, setLifecycleFilter] = useState("active"); const [sortBy, setSortBy] = useState<"score" | "amount" | "closeDate" | "changed">("score");
  const [selected, setSelected] = useState<string[]>([]); const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState("member"); const [loadingData, setLoadingData] = useState(true);
  const [showActivity, setShowActivity] = useState(false); const [activity, setActivity] = useState<ActivityLog[]>([]); const [activityQuery, setActivityQuery] = useState("");
  const [active, setActive] = useState<Opportunity | null>(null); const [showSettings, setShowSettings] = useState(false);
  const [showUpload, setShowUpload] = useState(false); const [notice, setNotice] = useState("AI scoring up to date");
  const [showDealWorkspace, setShowDealWorkspace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  useEffect(() => {
    if (!configured) { setLoadingData(false); return; }
    const supabase = createClient();
    (async () => {
      const { data: workspace, error: bootstrapError } = await supabase.rpc("bootstrap_workspace");
      if (bootstrapError || !workspace) { setNotice(bootstrapError?.message || "Workspace unavailable"); setLoadingData(false); return; }
      setWorkspaceId(workspace);
      const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspace).single();
      setRole(membership?.role || "member");
      await supabase.rpc("log_session_activity", { activity: "sign_in" });
      const { data, error } = await supabase.from("opportunities").select("*, score_runs(*)").eq("workspace_id", workspace).order("updated_at", { ascending: false });
      if (error) { setNotice(error.message); setLoadingData(false); return; }
      if (!data?.length) {
        const rows = seed.map(item => ({ workspace_id: workspace, salesforce_opportunity_id: item.id, source_data: item, lifecycle: "active", last_scored_at: new Date().toISOString() }));
        const { data: inserted } = await supabase.from("opportunities").upsert(rows, { onConflict: "workspace_id,salesforce_opportunity_id" }).select("id, salesforce_opportunity_id, updated_at");
        const ids = new Map((inserted || []).map(row => [row.salesforce_opportunity_id, row]));
        setOpportunities(seed.map(item => normalizeOpportunity({ ...item, dbId: ids.get(item.id)?.id, lifecycle: "active", updatedAt: ids.get(item.id)?.updated_at })));
      } else {
        setOpportunities(data.map(row => normalizeOpportunity({ ...(row.source_data as Opportunity), dbId: row.id, lifecycle: row.lifecycle, updatedAt: row.updated_at, lastScoredAt: row.last_scored_at, history: (row.score_runs || []).sort((a: ScoreHistory, b: ScoreHistory) => b.created_at.localeCompare(a.created_at)) })));
      }
      setLoadingData(false); setNotice("Workspace synced");
    })();
  }, [configured]);

  const persistOpportunity = async (opportunity: Opportunity) => {
    if (!configured || !workspaceId) return opportunity;
    const supabase = createClient();
    const clean = { ...opportunity }; delete clean.history; delete clean.dbId;
    const { data, error } = await supabase.from("opportunities").upsert({ workspace_id: workspaceId, salesforce_opportunity_id: opportunity.id, source_data: clean, lifecycle: opportunity.lifecycle || "active", last_scored_at: opportunity.lastScoredAt || null }, { onConflict: "workspace_id,salesforce_opportunity_id" }).select("id,updated_at").single();
    if (error) { setNotice(`Save failed: ${error.message}`); return opportunity; }
    return { ...opportunity, dbId: data.id, updatedAt: data.updated_at };
  };
  const recordScore = async (opportunity: Opportunity, trigger: string, result: Record<string, unknown>) => {
    if (!configured || !opportunity.dbId) return;
    const supabase = createClient();
    await supabase.from("score_runs").insert({ opportunity_id: opportunity.dbId, status: "completed", overall_score: opportunity.score, tier: opportunity.tier, confidence: opportunity.confidence, result, completed_at: new Date().toISOString(), model_version: 1, trigger });
  };
  const filtered = useMemo(() => opportunities.filter(o => (tier === "All" || o.tier === tier) && (stageFilter === "All" || o.stage === stageFilter) && (ownerFilter === "All" || o.owner === ownerFilter) && (lifecycleFilter === "All" || (o.lifecycle || "active") === lifecycleFilter) && `${o.name} ${o.account} ${o.source} ${o.partner}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortBy === "amount" ? b.amount - a.amount : sortBy === "changed" ? b.changed - a.changed : sortBy === "closeDate" ? a.closeDate.localeCompare(b.closeDate) : b.score - a.score), [opportunities, query, tier, stageFilter, ownerFilter, lifecycleFilter, sortBy]);
  const activeOpportunities = opportunities.filter(o => (o.lifecycle || "active") === "active");
  const stats = useMemo(() => { const scored = activeOpportunities.filter(o => o.lastScoredAt || o.score); const high = scored.filter(o => o.confidence === "High").length; return { pipeline: activeOpportunities.reduce((sum, o) => sum + o.amount, 0), hot: activeOpportunities.filter(o => o.tier === "Hot").reduce((sum, o) => sum + o.amount, 0), hotCount: activeOpportunities.filter(o => o.tier === "Hot").length, flags: activeOpportunities.filter(o => o.flags?.length).length, health: scored.length ? Math.round((high / scored.length) * 100) : 0 }; }, [opportunities]);
  const exportCsv = () => {
    const headings = ["Salesforce Opportunity ID", "Opportunity Score", "Priority Tier", "AI Confidence", "Hard Stop Flags", "Score Date"];
    const body = filtered.map(o => [o.id, o.score, o.tier, o.confidence, (o.flags || []).join("; "), new Date().toISOString().slice(0, 10)]);
    const csv = [headings, ...body].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "ilmas-route-to-revenue-salesforce-update.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const rows = parseCsv(await file.text()); const imported = rows.map(scoreFromRow);
    setNotice(`AI is scoring ${imported.length} imported opportunities…`);
    const uniformlyScored = await Promise.all(imported.map(async item => {
      try { const response=await fetch("/api/score",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunity:item,scoringModel:currentModel})}); if(!response.ok)return item; const ai=await response.json(); const overall=Math.round(Number(ai.overallScore)); return {...item,score:overall,tier:tierFromScore(overall),confidence:ai.confidence||item.confidence,flags:ai.flags||item.flags,analysis:{rationale:ai.rationale||"",categoryScores:Object.fromEntries((ai.categoryScores||[]).map((entry:CategoryAnalysis&{category:string})=>[entry.category,entry]))},lastScoredAt:new Date().toISOString()}; } catch { return item; }
    }));
    const saved = await Promise.all(uniformlyScored.map(item => persistOpportunity({ ...item, lifecycle: "active", updatedAt: new Date().toISOString() })));
    setOpportunities(current => {
      const map = new Map(current.map(o => [o.id, o])); saved.forEach(o => map.set(o.id, o)); return [...map.values()].sort((a, b) => b.score - a.score);
    });
    setShowUpload(false); setNotice(`Scored ${imported.length} imported opportunities`);
  };
  const addManualDeal = async (deal: Omit<Opportunity, "score" | "tier" | "changed" | "confidence">) => {
    const description = `${deal.nextStep} ${deal.source} ${deal.partner}`.toLowerCase();
    let score = 48 + (deal.amount >= 100000 ? 10 : 3) + (deal.stage === "Proposal" || deal.stage === "Negotiation" ? 15 : 0);
    if (description.includes("partner")) score += 4;
    score = Math.max(20, Math.min(95, score));
    let opportunity: Opportunity = { ...deal, score, tier: tierFromScore(score), changed: 0, confidence: "Medium", flags: score < 60 ? ["Budget not confirmed"] : undefined };
    setNotice(`AI is scoring ${opportunity.name}…`);
    try {
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity, scoringModel: currentModel }) });
      if (response.ok) {
        const ai = await response.json(); const overall = Math.round(Number(ai.overallScore));
        opportunity = { ...opportunity, score: overall, tier: tierFromScore(overall), confidence: ai.confidence || "Medium", flags: ai.flags || opportunity.flags };
      }
    } catch { /* The deterministic qualification score remains available if AI is temporarily unavailable. */ }
    opportunity = await persistOpportunity({ ...opportunity, lifecycle: "active", lastScoredAt: new Date().toISOString() });
    await recordScore(opportunity, "create", opportunity.analysis || {});
    setOpportunities(current => [opportunity, ...current].sort((a, b) => b.score - a.score));
    setNotice(`Scored ${opportunity.name}`); setShowDealWorkspace(false); setActive(opportunity);
  };
  const rescoreOpportunity = async (opportunity: Opportunity, categoryPoints: Record<string, number>, notes: string) => {
    setNotice(`Re-scoring ${opportunity.name} with your updates…`);
    let updated = opportunity;
    try {
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, manualCategoryPoints: categoryPoints, qualificationNotes: notes }, scoringModel: currentModel }) });
      if (response.ok) {
        const ai = await response.json(); const overall = Math.round(Number(ai.overallScore));
        const categoryScores = Object.fromEntries((ai.categoryScores || []).map((item: CategoryAnalysis & { category: string }) => [item.category, item]));
        updated = { ...opportunity, score: overall, tier: tierFromScore(overall), confidence: ai.confidence || opportunity.confidence, flags: ai.flags || opportunity.flags, changed: overall - opportunity.score, analysis: { rationale: ai.rationale || "", categoryScores }, dealData: { ...opportunity.dealData, qualificationNotes: notes, ...Object.fromEntries(Object.entries(categoryScores).map(([key, value]) => [`aiPoints:${key}`, String((value as CategoryAnalysis).points)])), ...Object.fromEntries(Object.entries(categoryPoints).map(([key, value]) => [`manualPoints:${key}`, String(value)])) } };
      }
    } catch { /* Preserve the user's category changes even if the AI service is momentarily unavailable. */ }
    updated = await persistOpportunity({ ...updated, lastScoredAt: new Date().toISOString() });
    await recordScore(updated, "manual", updated.analysis || {});
    setOpportunities(list => list.map(item => item.id === opportunity.id ? updated : item));
    setActive(updated); setNotice(`Updated score for ${updated.name}`);
  };
  const saveOverride = async (opportunity: Opportunity, value: number, reason: string) => {
    const updated = await persistOpportunity({ ...opportunity, score: value, tier: tierFromScore(value), changed: value - opportunity.score, lastScoredAt: new Date().toISOString() });
    if (configured && updated.dbId) {
      const supabase = createClient(); const { data: claims } = await supabase.auth.getClaims();
      const { data: run } = await supabase.from("score_runs").insert({ opportunity_id: updated.dbId, status: "completed", overall_score: value, tier: updated.tier, confidence: updated.confidence, result: { overrideReason: reason }, completed_at: new Date().toISOString(), model_version: 1, trigger: "manual", created_by: claims?.claims?.sub }).select("id").single();
      if (run) await supabase.from("score_overrides").insert({ score_run_id: run.id, prior_value: opportunity.score, new_value: value, reason, created_by: claims?.claims?.sub });
    }
    setOpportunities(list => list.map(item => item.id === opportunity.id ? updated : item)); setActive(updated); setNotice(`Override saved with audit reason`);
  };
  const archiveSelected = async () => {
    const targets = opportunities.filter(item => selected.includes(item.id));
    const saved = await Promise.all(targets.map(item => persistOpportunity({ ...item, lifecycle: "archived" })));
    const byId = new Map(saved.map(item => [item.id, item])); setOpportunities(list => list.map(item => byId.get(item.id) || item)); setSelected([]); setNotice(`Archived ${saved.length} opportunities`);
  };
  const rescoreSelected = async () => {
    const targets = opportunities.filter(item => selected.includes(item.id));
    for (const item of targets) await rescoreOpportunity(item, Object.fromEntries(categories.flatMap(([label]) => { const raw=item.dealData?.[`manualPoints:${String(label)}`]; const value=Number(raw); return raw!==undefined&&raw!==""&&Number.isFinite(value)?[[String(label),value]]:[]; })), item.dealData?.qualificationNotes || "");
    setSelected([]); setNotice(`Re-scored ${targets.length} opportunities`);
  };
  const logout = async () => { if (configured) await createClient().auth.signOut(); window.location.href = "/signin"; };
  const openActivity = async () => {
    if (role !== "admin") return;
    setShowActivity(true);
    if (!workspaceId) return;
    const { data, error } = await createClient().from("activity_logs").select("id,actor_email,action,entity_type,entity_id,detail,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500);
    if (error) { setNotice(error.message); return; }
    setActivity((data || []) as ActivityLog[]);
  };
  const saveModel = async (model: (string | number)[][]) => {
    if (role !== "admin") { setNotice("Only workspace admins can change the scoring model"); return false; }
    if (model.reduce((sum,item)=>sum+Number(item[1]),0)!==100) { setNotice("Scoring weights must total 100%"); return false; }
    if (configured && workspaceId) {
      const supabase=createClient(); const {data:claims}=await supabase.auth.getClaims(); const {data:latest}=await supabase.from("scoring_models").select("version").eq("workspace_id",workspaceId).order("version",{ascending:false}).limit(1).maybeSingle();
      const {error}=await supabase.from("scoring_models").insert({workspace_id:workspaceId,version:(latest?.version||0)+1,model,created_by:claims?.claims?.sub}); if(error){setNotice(error.message);return false;}
    }
    setCurrentModel(model); setNotice("Scoring model saved; active opportunities are being re-scored");
    for (const item of activeOpportunities) await rescoreOpportunity(item,Object.fromEntries(model.flatMap(([label])=>{const raw=item.dealData?.[`manualPoints:${String(label)}`];const value=Number(raw);return raw!==undefined&&raw!==""&&Number.isFinite(value)?[[String(label),value]]:[]})),item.dealData?.qualificationNotes||"");
    return true;
  };
  return <main>
    <header className="topbar"><div className="brand"><img className="brand-logo" src="/ilma-logo.png" alt="Ilma llama logo"/><span>Ilma&apos;s Route to Revenue</span></div><nav><a className={!showActivity?"active":""} onClick={()=>setShowActivity(false)}>Opportunities</a><a onClick={() => setShowSettings(true)}>Settings</a>{role==="admin"&&<a className={showActivity?"active":""} onClick={openActivity}>Admin</a>}</nav><div className="top-actions"><span className="sync"><span className="sync-dot" />{loadingData ? "Loading workspace…" : notice}</span><span className="user-email">{userEmail}{role==="admin"?" · Admin":""}</span><button className="icon-btn" onClick={logout} aria-label="Sign out"><LogOut size={16}/></button></div></header>
    {showActivity ? <AdminActivity logs={activity} query={activityQuery} setQuery={setActivityQuery} onRefresh={openActivity} model={currentModel} onSave={saveModel}/> : <>
    <section className="shell">
      <div className="eyebrow"><Sparkles size={15}/> AI-assisted opportunity prioritization</div>
      <div className="heading-row"><div><h1>Route to Revenue</h1><p>Know exactly where to focus next.</p></div><div className="actions"><button className="btn secondary" onClick={() => setShowSettings(true)}><Settings2 size={16}/> Scoring model</button><button className="btn secondary" onClick={exportCsv}><ArrowDownToLine size={16}/> Export to Salesforce</button><button className="btn secondary" onClick={() => setShowDealWorkspace(true)}><Plus size={16}/> Add deal</button><button className="btn primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Upload report</button></div></div>
      <section className="metrics"><div className="metric"><span>Active pipeline</span><strong>{money.format(stats.pipeline)}</strong><small>{activeOpportunities.length} active opportunities</small></div><div className="metric"><span>Hot opportunities</span><strong>{money.format(stats.hot)}</strong><small className="positive">{stats.hotCount} deals ready for focus</small></div><div className="metric"><span>Qualification gaps</span><strong>{stats.flags}</strong><small className="warning-text">Need validation before advance</small></div><div className="metric score-card"><span>Scoring health</span><strong>{stats.health}%</strong><div className="progress"><i style={{width:`${stats.health}%`}} /></div><small>Share of scored deals with high confidence</small></div></section>
      <section className="table-card"><div className="table-toolbar"><div className="table-title"><h2>Ranked opportunities</h2><span>{filtered.length} shown · refreshed {new Date().toLocaleDateString()}</span></div><div className="toolbar-controls"><label className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search opportunities" /></label><select aria-label="Stage filter" value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option>All</option>{[...new Set(opportunities.map(o=>o.stage))].map(value=><option key={value}>{value}</option>)}</select><select aria-label="Owner filter" value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option>All</option>{[...new Set(opportunities.map(o=>o.owner))].map(value=><option key={value}>{value}</option>)}</select><select aria-label="Lifecycle filter" value={lifecycleFilter} onChange={e=>setLifecycleFilter(e.target.value)}><option value="All">All lifecycle</option><option value="active">Active</option><option value="archived">Archived</option><option value="closed_won">Closed won</option><option value="closed_lost">Closed lost</option></select><select aria-label="Sort opportunities" value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}><option value="score">Score</option><option value="amount">Amount</option><option value="closeDate">Close date</option><option value="changed">Score change</option></select></div></div>
        {selected.length > 0 && <div className="bulk-bar"><strong>{selected.length} selected</strong><button className="btn secondary" onClick={rescoreSelected}>Re-score</button><button className="btn secondary" onClick={archiveSelected}>Archive</button><button className="btn secondary" onClick={()=>setSelected([])}>Clear</button></div>}
        <div className="tier-filter">{(["All", "Hot", "Work", "Nurture", "Deprioritize"] as const).map(item => <button key={item} className={tier === item ? "selected" : ""} onClick={() => setTier(item)}>{item === "All" ? "All opportunities" : <><i className={`dot ${item.toLowerCase()}`} />{item}</>}</button>)}</div>
        <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select All Shown" checked={filtered.length>0&&filtered.every(o=>selected.includes(o.id))} onChange={e=>setSelected(e.target.checked?filtered.map(o=>o.id):[])}/></th><th>Opportunity <ChevronDown size={13}/></th><th>Score</th><th>Amount</th><th>Stage</th><th>Close Date</th><th>Source</th><th>Partner</th><th>Next Step</th><th>Last Score</th><th /></tr></thead><tbody>{filtered.map(o => <Fragment key={o.id}><tr className={active?.id === o.id ? "expanded" : ""} onClick={() => setActive(current => current?.id === o.id ? null : o)}><td onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Select ${o.name}`} checked={selected.includes(o.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,o.id]:current.filter(id=>id!==o.id))}/></td><td><strong>{o.name}</strong><span>{o.account} · {o.owner}</span></td><td><div className="score-cell"><b className={`score ${o.tier.toLowerCase()}`}>{o.score}</b><span>{o.tier}</span></div></td><td><strong>{money.format(o.amount)}</strong><span>{o.forecast}</span></td><td><span className="stage">{o.stage}</span></td><td>{o.closeDate}</td><td>{o.source}</td><td>{o.partner}</td><td className="next"><strong>{o.nextStep}</strong><span>{o.nextStepDate}</span></td><td><span className={o.changed >= 0 ? "change up" : "change down"}>{o.changed >= 0 ? "+" : ""}{o.changed} pts</span><span>{o.confidence} confidence</span></td><td><button className="row-menu" aria-label="More Actions"><MoreHorizontal size={17}/></button></td></tr>{active?.id === o.id && <OpportunityDrilldown opportunity={active} onClose={() => setActive(null)} onRescore={rescoreOpportunity} />}</Fragment>)}</tbody></table></div>
      </section>
    </section>
    {showUpload && <div className="overlay"><section className="modal upload-modal"><button className="close" onClick={() => setShowUpload(false)}><X size={19}/></button><div className="modal-icon"><Upload size={23}/></div><h2>Upload Salesforce report</h2><p>Upload an Opportunity Report CSV. We&apos;ll detect the Salesforce fields, preserve existing opportunities, and score only records that changed.</p><button className="dropzone" onClick={() => input.current?.click()}><Upload size={22}/><strong>Choose a CSV report</strong><span>Salesforce Opportunity Report export · CSV only</span></button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/><div className="modal-note"><Bot size={15}/> AI analysis uses only approved mapped columns. You&apos;ll be able to review those columns before your first production import.</div></section></div>}
    {showDealWorkspace && <DealWorkspace onClose={() => setShowDealWorkspace(false)} onSave={addManualDeal} />}
    {showSettings && <SettingsPanel model={currentModel} role={role} onClose={() => setShowSettings(false)} onSave={saveModel} />}</>}
  </main>;
}

function AdminActivity({ logs, query, setQuery, onRefresh, model, onSave }: { logs: ActivityLog[]; query: string; setQuery: (value:string)=>void; onRefresh: ()=>void; model:(string|number)[][]; onSave:(model:(string|number)[][])=>Promise<boolean> }) {
  const [draft,setDraft]=useState(model.map(item=>[item[0],item[1]])); const [saving,setSaving]=useState(false); const total=draft.reduce((sum,item)=>sum+Number(item[1]),0);
  const visible=logs.filter(log=>`${log.actor_email||"system"} ${log.action} ${log.entity_type} ${log.entity_id||""}`.toLowerCase().includes(query.toLowerCase()));
  const describe=(log:ActivityLog)=>{ const detail=log.detail as {new?:Record<string,unknown>;old?:Record<string,unknown>}; const record=detail?.new||detail?.old||{}; const source=record.source_data as Record<string,unknown>|undefined; return String(source?.name||source?.account||record.salesforce_opportunity_id||log.entity_id||"—"); };
  return <section className="shell admin-activity"><div className="eyebrow"><Settings2 size={15}/> Administrator Only</div><div className="heading-row"><div><h1>Admin</h1><p>Manage the shared scoring model and review immutable workspace activity.</p></div><button className="btn secondary" onClick={onRefresh}>Refresh Activity</button></div><section className="admin-settings"><div className="section-title"><div><h2>Scoring Settings</h2><p>Set the maximum points available for each category. The total must equal 100.</p></div></div><div className="settings-list">{draft.map(([name,points],index)=><div key={String(name)}><strong>{name}</strong><label><input type="number" min="0" max="100" value={String(points)} onChange={e=>setDraft(current=>current.map((item,i)=>i===index?[item[0],Number(e.target.value)]:item))}/> Points</label></div>)}</div><div className="settings-footer"><span className={total===100?"positive":"warning-text"}>Total {total} Points · Admin Access</span><button className="btn primary" disabled={total!==100||saving} onClick={async()=>{setSaving(true);await onSave(draft);setSaving(false)}}>{saving?"Saving And Re-Scoring…":"Save And Re-Score"}</button></div></section><section className="metrics"><div className="metric"><span>Recorded Events</span><strong>{logs.length}</strong><small>Most recent 500 events</small></div><div className="metric"><span>Active Users</span><strong>{new Set(logs.map(log=>log.actor_email).filter(Boolean)).size}</strong><small>Authenticated actors in this log</small></div><div className="metric"><span>Score Events</span><strong>{logs.filter(log=>log.entity_type==="score_runs").length}</strong><small>Creates, edits, and re-scores</small></div></section><section className="table-card"><div className="table-toolbar"><div className="table-title"><h2>All Activity</h2><span>{visible.length} matching events</span></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search user, action, or record"/></label></div><div className="table-wrap"><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Area</th><th>Record</th></tr></thead><tbody>{visible.map(log=><tr key={log.id}><td><strong>{new Date(log.created_at).toLocaleDateString()}</strong><span>{new Date(log.created_at).toLocaleTimeString()}</span></td><td>{log.actor_email||"System"}</td><td><span className="stage">{log.action.replaceAll("_"," ")}</span></td><td>{log.entity_type.replaceAll("_"," ")}</td><td>{describe(log)}</td></tr>)}</tbody></table></div></section></section>;
}

function OpportunityDrilldown({ opportunity, onClose, onRescore }: { opportunity: Opportunity; onClose: () => void; onRescore: (opportunity: Opportunity, points: Record<string, number>, notes: string) => void }) {
  const [dealData, setDealData] = useState<DealData>(() => ({ ...opportunity.dealData, name: opportunity.name, account: opportunity.account, amount: String(opportunity.amount), closeDate: opportunity.closeDate, stage: opportunity.stage, forecast: opportunity.forecast, owner: opportunity.owner, source: opportunity.source, partner: opportunity.partner, nextStep: opportunity.nextStep, nextStepDate: opportunity.nextStepDate }));
  const [manualPoints, setManualPoints] = useState<Record<string, string>>(() => Object.fromEntries(categories.map(([rawLabel]) => { const label=String(rawLabel); return [label, opportunity.dealData?.[`manualPoints:${label}`] || ""]; })));
  const [notes, setNotes] = useState("");
  const analysisNames: Record<string, string> = {
    "Ideal Customer Fit": "Fit Analysis", "Pain And Urgency": "Pain Analysis", "Executive Sponsor": "Sponsor Analysis",
    "Budget And Funding Confidence": "Budget Analysis", "Timing / Compelling Event": "Timing Analysis", "Solution Fit": "Solution Analysis",
    "Value Proposition": "Value Analysis", "Engagement / Activity": "Activity Analysis", "Procurement Path": "Procurement Analysis",
    "Competitive Position": "Competitive Analysis", "Strategic Value": "Strategic Analysis", "Existing Relationships": "Relationship Analysis",
    "Resource Requirements": "Resource Analysis"
  };
  const fieldValue = (label: string) => dealData[`qualification:${label}`] || (label === "Engagement / Activity" ? `${opportunity.source} lead. Next step: ${opportunity.nextStep}.` : "");
  const editedOpportunity = () => ({ ...opportunity, name: dealData.name || opportunity.name, account: dealData.account || opportunity.account, amount: Number(dealData.amount)||0, closeDate: dealData.closeDate || opportunity.closeDate, stage: dealData.stage || opportunity.stage, forecast: dealData.forecast || opportunity.forecast, owner: dealData.owner || opportunity.owner, source: dealData.source || opportunity.source, partner: dealData.partner || opportunity.partner, nextStep: dealData.nextStep || opportunity.nextStep, nextStepDate: dealData.nextStepDate || opportunity.nextStepDate, dealData });
  const overrides = () => Object.fromEntries(categories.flatMap(([rawLabel,rawMaximum])=>{const label=String(rawLabel);const maximum=Number(rawMaximum);const raw=manualPoints[label];return raw!==""?[[label,Math.min(maximum,Math.max(0,Number(raw)||0))]]:[];}));
  return <tr className="drilldown-row"><td colSpan={11}><div className="drilldown">
    <div className="panel-head"><div><span className="eyebrow"><Bot size={14}/> AI score · {opportunity.confidence} confidence</span><h2>{opportunity.name}</h2><p>{opportunity.account} · {money.format(opportunity.amount)} · {opportunity.stage}</p></div><button className="drilldown-close" onClick={onClose}>Close <X size={17}/></button></div>
    <div className="panel-score"><div><span>Overall Score</span><strong>{opportunity.score}</strong><b className={`tier-badge ${opportunity.tier.toLowerCase()}`}>{opportunity.tier}</b></div><p>Review the qualification inputs below. Your updates become evidence for the next AI score run.</p></div>
    <details className="detail-editor"><summary>Sales Opportunity Detail · Click To Edit</summary><div className="deal-grid">{salesforceFields.map(([label,key,hint])=><label key={key}>{label}{hint&&<small>{hint}</small>}<input value={dealData[key]||""} onChange={e=>setDealData(current=>({...current,[key]:e.target.value}))}/></label>)}</div></details>
    {opportunity.flags?.length ? <div className="alert"><CircleAlert size={17}/><div><strong>Qualification gap</strong><span>{opportunity.flags.join(" · ")}</span></div></div> : null}
    <section className="explanation"><h3>Scoring Rationale</h3><p>{opportunity.analysis?.rationale || "The AI uses the imported deal context plus the qualification detail below."}</p><div className="evidence"><span>Evidence Used</span><b>Opportunity Description</b><b>Next Step</b><b>Partner Field</b></div></section>
    <section className="category-list"><div className="category-header"><div><h3>Full Category Detail</h3><p>Each category shows its maximum points, AI recommendation, and optional capped manual override.</p></div><button className="btn primary rescore" onClick={() => onRescore(editedOpportunity(), overrides(), notes)}><Sparkles size={15}/> Save Changes &amp; Re-Score</button></div>
      {categories.map(([rawLabel, rawMaximum]) => { const label=String(rawLabel); const maximum=Number(rawMaximum); const recommended=opportunity.analysis?.categoryScores[label]?.points; const stored=Number(dealData[`aiPoints:${label}`]); const aiPoints=Math.min(maximum,Math.max(0,recommended ?? (Number.isFinite(stored)?stored:maximum*.2))); const manual=manualPoints[label]; const effective=manual===""?aiPoints:Math.min(maximum,Math.max(0,Number(manual)||0)); return <article className="category-detail-tile" key={label}><div className="category-tile-head"><div><strong>{label}</strong><span>Maximum {maximum} Points · Effective Score {effective} / {maximum}</span></div><div className="point-fields"><label>AI Recommended<input readOnly value={aiPoints}/></label><label>Manual Override<input type="number" min="0" max={maximum} step="0.1" placeholder="Optional" value={manual} onChange={e=>setManualPoints(current=>({...current,[label]:e.target.value===""?"":String(Math.min(maximum,Math.max(0,Number(e.target.value)||0)))}))}/></label></div></div><div className="category-tile-body"><label><b>Field Value:</b><textarea value={fieldValue(label)} placeholder={`Enter evidence for ${label.toLowerCase()}`} onChange={e=>setDealData(current=>({...current,[`qualification:${label}`]:e.target.value}))}/></label><p><b>{analysisNames[label] || "Category Analysis"}:</b> {opportunity.analysis?.categoryScores[label]?.rationale || `The AI recommends ${aiPoints} of ${maximum} available points based on the current evidence.`}</p></div></article>; })}
      <label className="qualification-notes">Qualification Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add what you learned about budget, buyer access, timing, competition, procurement, resources, or relationships…" /></label>
    </section>
    {opportunity.history?.length ? <section className="score-history"><h3>Score History</h3>{opportunity.history.slice(0,8).map(run=><div key={run.id}><strong>{Math.round(run.overall_score)} · {run.tier}</strong><span>{new Date(run.created_at).toLocaleString()} · {run.trigger} · model v{run.model_version||1}</span></div>)}</section>:null}
  </div></td></tr>;
}

function SettingsPanel({ model, role, onClose, onSave }: { model: (string|number)[][]; role: string; onClose: () => void; onSave: (model:(string|number)[][])=>Promise<boolean> }) {
  const [draft,setDraft]=useState(model.map(item=>[item[0],item[1]])); const [saving,setSaving]=useState(false); const total=draft.reduce((sum,item)=>sum+Number(item[1]),0);
  return <div className="overlay"><section className="modal settings-modal"><button className="close" onClick={onClose}><X size={19}/></button><div className="eyebrow"><Settings2 size={15}/> Shared Scoring Model</div><h2>Qualification Model</h2><p>Each category has a maximum point value. Changes create a new version and automatically re-score active opportunities. Admin access is required.</p><div className="settings-list">{draft.map(([name, weight],index) => <div key={String(name)}><strong>{name}</strong><label><input value={String(weight)} min="0" max="100" type="number" disabled={role!=="admin"} onChange={e=>setDraft(current=>current.map((item,i)=>i===index?[item[0],Number(e.target.value)]:item))}/> Points</label></div>)}</div><div className="settings-footer"><span className={total===100?"positive":"warning-text"}>Total {total} Points · {role} access</span><button className="btn primary" disabled={role!=="admin"||total!==100||saving} onClick={async()=>{setSaving(true);if(await onSave(draft))onClose();setSaving(false)}}>{saving?"Saving…":"Save And Re-Score"}</button></div></section></div>;
}

function DealWorkspace({ onClose, onSave }: { onClose: () => void; onSave: (deal: Omit<Opportunity, "score" | "tier" | "changed" | "confidence">) => void }) {
  const [data, setData] = useState<DealData>(() => ({ ...defaultDealData(), stage: "Qualification", forecast: "Pipeline", source: "Manual", probability: "10" }));
  const [manualPoints, setManualPoints] = useState<Record<string,string>>(defaultPoints); const [analysis, setAnalysis] = useState<ScoreAnalysis | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"ready" | "scoring" | "error">("ready");
  const update = (key: string, value: string) => setData(current => ({ ...current, [key]: value }));
  const opportunityFromForm = (): Opportunity => {
    const amount = Number((data.amount || "").replace(/[^0-9.-]/g, "")) || 0;
    const score = Math.round(categories.reduce((sum, [label, maximum]) => { const raw=manualPoints[String(label)]; const ai=analysis?.categoryScores[String(label)]?.points ?? Number(maximum)*.2; return sum+(raw===""?ai:Math.min(Number(maximum),Math.max(0,Number(raw)||0))); }, 0));
    return { id: data.salesforceId || `manual-${Date.now()}`, name: data.name || "Untitled opportunity", account: data.account || "Unassigned account", amount, closeDate: data.closeDate || "Not provided", stage: data.stage || "Qualification", forecast: data.forecast || "Pipeline", owner: data.owner || "Unassigned", source: data.source || "Manual", partner: data.partner || "—", nextStep: data.nextStep || "Validate qualification", nextStepDate: data.nextStepDate || "—", score, tier: tierFromScore(score), changed: 0, confidence: "Medium", dealData: data };
  };
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setStatus("scoring"); const opportunity = opportunityFromForm();
      try {
        const manualCategoryPoints = Object.fromEntries(categories.flatMap(([label,maximum])=>{const raw=manualPoints[String(label)];return raw!==""?[[String(label),Math.min(Number(maximum),Math.max(0,Number(raw)||0))]]:[];}));
        const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, salesforceFields: data, manualCategoryPoints, qualificationNotes: data.qualificationNotes || "" }, scoringModel: categories }) });
        if (!response.ok) throw new Error("Scoring failed");
        const ai = await response.json();
        setAnalysis({ rationale: ai.rationale || "Analysis is ready.", categoryScores: Object.fromEntries((ai.categoryScores || []).map((item: CategoryAnalysis & { category: string }) => [item.category, item])) });
        setStatus("ready");
      } catch { setStatus("error"); }
    }, 850);
    return () => window.clearTimeout(timer);
  // Scoring happens after the seller pauses typing, avoiding a request per keystroke.
  }, [data, manualPoints]);
  const submit = () => {
    if (!data.name.trim() || !data.account.trim()) return;
    const opportunity = opportunityFromForm();
    const aiPoints = Object.fromEntries(categories.map(([label,maximum]) => [String(label), analysis?.categoryScores[String(label)]?.points ?? Number(maximum)*.2]));
    onSave({ ...opportunity, dealData: { ...data, qualificationNotes: data.qualificationNotes || "", ...Object.fromEntries(Object.entries(aiPoints).map(([key, value]) => [`aiPoints:${key}`, String(value)])), ...Object.fromEntries(Object.entries(manualPoints).filter(([,value])=>value!=="").map(([key,value])=>[`manualPoints:${key}`,value])) } });
  };
  const analysisFor = (label: string) => analysis?.categoryScores[label];
  const effectivePoints = (label: string, maximum: number) => {
    const recommended = analysisFor(label)?.points ?? maximum * 0.2;
    const manual = manualPoints[label];
    return manual === "" ? recommended : Math.min(maximum, Math.max(0, Number(manual) || 0));
  };
  const liveScore = Math.round(categories.reduce((sum, [label, maximum]) => sum + effectivePoints(String(label), Number(maximum)), 0));
  return <section className="workspace"><div className="workspace-head"><div><div className="eyebrow"><Plus size={15}/> New Opportunity</div><h1>Add A Deal</h1><p>A dedicated working tab for Salesforce data, qualification evidence, and live analysis.</p></div><div className="workspace-actions"><span className={`workspace-status ${status}`}>{status === "scoring" ? "Updating analysis…" : status === "error" ? "Analysis will retry after your next update" : "Analysis up to date"}</span><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!data.name.trim() || !data.account.trim()} onClick={submit}>Add Scored Deal <ArrowUpRight size={16}/></button></div></div><div className="workspace-grid"><div className="workspace-form"><section className="form-card"><div className="section-title"><div><h2>Salesforce Deal Detail</h2><p>Enter the fields from the Opportunity record. Required fields are marked.</p></div></div><div className="deal-grid">{salesforceFields.map(([label, key, hint]) => <label key={key} className={key === "description" || key === "nextStep" ? "wide" : ""}>{label}{hint && <small>{hint}</small>}{key === "stage" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Prospecting", "Qualification", "Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(item => <option key={item}>{item}</option>)}</select> : key === "forecast" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Pipeline", "Best Case", "Commit", "Closed"].map(item => <option key={item}>{item}</option>)}</select> : key === "description" || key === "nextStep" ? <textarea value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "description" ? "Customer context, use case, scope, stakeholders…" : "What must happen next?"} /> : <input type={key === "closeDate" || key === "nextStepDate" ? "date" : key === "amount" || key === "probability" ? "number" : "text"} value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "amount" ? "0" : ""} />}</label>)}</div></section><section className="form-card"><div className="section-title"><div><h2>Deal Qualification</h2><p>Every category starts collapsed. The title and score remain visible; open a group to update evidence and see its analysis.</p></div></div><div className="qualification-accordions">{qualificationFields.map(([label, key]) => { const item=analysisFor(label); const isOpen=!!openCategories[label]; const maximum=Number(categories.find(([name])=>String(name)===label)?.[1]||0); const recommended=item?.points ?? maximum*.2; const effective=effectivePoints(label,maximum); return <article className={`qualification-group ${isOpen ? "open" : ""}`} key={key}><button type="button" className="qualification-summary" onClick={() => setOpenCategories(current => ({ ...current, [label]: !current[label] }))}><span>{label}</span><b>{effective} / {maximum} Points</b><ChevronDown size={17}/></button>{isOpen && <div className="qualification-content"><label>Seller-Entered Qualification Evidence<textarea value={data[key] || ""} onChange={e => update(key, e.target.value)} placeholder={`Evidence for ${label.toLowerCase()}…`} /></label><div className="point-fields"><label>AI Recommended<input readOnly value={recommended}/></label><label>Manual Override<input type="number" min="0" max={maximum} step="0.1" placeholder="Optional" value={manualPoints[label]} onChange={e=>setManualPoints(current=>({...current,[label]:e.target.value===""?"":String(Math.min(maximum,Math.max(0,Number(e.target.value)||0)))}))}/></label></div><div className="category-analysis"><strong>Resulting Analysis</strong><p>{item?.rationale || "Analysis will appear here after your update is scored."}</p>{item?.evidence?.length ? <p><b>Evidence Used:</b> {item.evidence.join(" · ")}</p> : null}{item?.missingInformation?.length ? <small>Still Needed: {item.missingInformation.join(" · ")}</small> : null}</div></div>}</article>; })}<label className="qualification-notes">Additional Qualification Notes<textarea value={data.qualificationNotes || ""} onChange={e => update("qualificationNotes", e.target.value)} placeholder="Budget, executive sponsor, timing, competition, procurement, relationships, or any other context…" /></label></div></section></div><aside className="analysis-card"><div className="analysis-score"><span>Live Opportunity Score</span><strong>{liveScore}</strong><b>{tierFromScore(liveScore)}</b></div><h2>Qualification Analysis</h2><p className="analysis-intro">{analysis?.rationale || "Add deal information and evidence. Analysis updates automatically when you pause after a change."}</p><p className="analysis-hint">Open a category to view the data entered and its resulting analysis.</p></aside></div></section>;
}
