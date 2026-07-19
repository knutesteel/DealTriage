"use client";

import "./manual.css";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpRight, Bot, ChevronDown, CircleAlert, Filter,
  MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, Sparkles,
  Upload, X
} from "lucide-react";

type Tier = "Hot" | "Work" | "Nurture" | "Deprioritize";
type Opportunity = {
  id: string; name: string; account: string; score: number; tier: Tier; amount: number;
  closeDate: string; stage: string; forecast: string; owner: string; source: string;
  partner: string; nextStep: string; nextStepDate: string; changed: number;
  confidence: "High" | "Medium" | "Low"; flags?: string[];
  dealData?: DealData; analysis?: ScoreAnalysis;
};

type DealData = Record<string, string>;
type CategoryAnalysis = { rating: number; rationale: string; evidence: string[]; missingInformation: string[]; hardStop: boolean };
type ScoreAnalysis = { rationale: string; categoryScores: Record<string, CategoryAnalysis> };

const seed: Opportunity[] = [
  { id: "006A000001", name: "Enterprise Compliance Platform", account: "State of Colorado", score: 91, tier: "Hot", amount: 420000, closeDate: "Sep 30, 2026", stage: "Proposal", forecast: "Commit", owner: "Ilma Choi", source: "Partner", partner: "Carahsoft", nextStep: "Confirm final security language", nextStepDate: "Aug 8", changed: 6, confidence: "High" },
  { id: "006A000002", name: "Trust Management Expansion", account: "City of Austin", score: 84, tier: "Hot", amount: 185000, closeDate: "Aug 31, 2026", stage: "Negotiation", forecast: "Best Case", owner: "Ilma Choi", source: "Outbound", partner: "—", nextStep: "Economic buyer review", nextStepDate: "Aug 5", changed: 4, confidence: "High" },
  { id: "006A000003", name: "Security Automation Program", account: "University of Michigan", score: 72, tier: "Work", amount: 250000, closeDate: "Nov 15, 2026", stage: "Discovery", forecast: "Pipeline", owner: "C. Morris", source: "Event", partner: "Deloitte", nextStep: "Map procurement vehicle", nextStepDate: "Aug 13", changed: -3, confidence: "Medium", flags: ["No procurement path"] },
  { id: "006A000004", name: "Vendor Risk Management", account: "Harris County", score: 66, tier: "Work", amount: 148000, closeDate: "Dec 18, 2026", stage: "Qualification", forecast: "Pipeline", owner: "Ilma Choi", source: "Inbound", partner: "—", nextStep: "Validate funding source", nextStepDate: "Aug 11", changed: 2, confidence: "Medium", flags: ["Budget not confirmed"] },
  { id: "006A000005", name: "Continuous Compliance Pilot", account: "Commonwealth of Virginia", score: 53, tier: "Nurture", amount: 95000, closeDate: "Jan 30, 2027", stage: "Discovery", forecast: "Pipeline", owner: "A. Patel", source: "Partner", partner: "Guidehouse", nextStep: "Schedule technical discovery", nextStepDate: "Aug 20", changed: 0, confidence: "Low", flags: ["No compelling event"] },
  { id: "006A000006", name: "Public Sector Risk Program", account: "City of Phoenix", score: 32, tier: "Deprioritize", amount: 120000, closeDate: "Mar 31, 2027", stage: "Prospecting", forecast: "Pipeline", owner: "Ilma Choi", source: "Outbound", partner: "—", nextStep: "Reconnect after budget cycle", nextStepDate: "Oct 1", changed: -5, confidence: "Low", flags: ["No buyer access", "Stale next step"] }
];

const categories = [
  ["Ideal customer fit", 10], ["Pain and urgency", 12], ["Buying authority / access", 10],
  ["Budget and funding confidence", 12], ["Timing / compelling event", 10], ["Solution fit and expected value", 10],
  ["Engagement / activity", 7], ["Procurement path / feasibility", 7], ["Competitive position", 5],
  ["Strategic value / expansion", 4], ["Existing relationships", 7], ["Partner relationships", 6]
];

const salesforceFields = [
  ["Opportunity name", "name", "Required"], ["Salesforce opportunity ID", "salesforceId", "Optional for a new deal"],
  ["Account name", "account", "Required"], ["Salesforce account ID", "accountId", ""],
  ["Primary contact", "primaryContact", ""], ["Contact ID", "contactId", ""],
  ["Amount", "amount", "USD"], ["Close date", "closeDate", ""],
  ["Stage", "stage", ""], ["Probability", "probability", "%"],
  ["Forecast category", "forecast", ""], ["Type", "type", ""], ["Lead source", "source", ""],
  ["Owner", "owner", ""], ["Campaign", "campaign", ""], ["Partner / reseller", "partner", ""],
  ["Next step", "nextStep", ""], ["Next step date", "nextStepDate", ""], ["Description", "description", ""]
] as const;

const qualificationFields = categories.map(([label]) => [String(label), `qualification:${String(label)}`] as const);
const defaultRatings = () => Object.fromEntries(categories.map(([label]) => [String(label), 3]));
const defaultDealData = (): DealData => Object.fromEntries(salesforceFields.map(([, key]) => [key, ""]));

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
  const flags = score < 60 ? ["Budget not confirmed"] : undefined;
  return {
    id: pick("Opportunity ID", "Id", "ID") || `import-${index + 1}`,
    name: pick("Opportunity Name", "Name") || `Imported opportunity ${index + 1}`,
    account: pick("Account Name", "Account") || "Unmapped account", score, tier: tierFromScore(score), amount,
    closeDate: pick("Close Date", "CloseDate") || "Not provided", stage,
    forecast: pick("Forecast Category", "ForecastCategoryName") || "Pipeline",
    owner: pick("Opportunity Owner", "Owner") || "Unassigned", source: pick("Lead Source", "LeadSource") || "—",
    partner: pick("Partner", "Reseller") || "—", nextStep: pick("Next Step", "NextStep") || "Validate qualification",
    nextStepDate: pick("Next Step Date") || "—", changed: 0, confidence: score >= 75 ? "High" : "Medium", flags
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

export default function Home() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(seed);
  const [query, setQuery] = useState(""); const [tier, setTier] = useState<"All" | Tier>("All");
  const [active, setActive] = useState<Opportunity | null>(null); const [showSettings, setShowSettings] = useState(false);
  const [showUpload, setShowUpload] = useState(false); const [notice, setNotice] = useState("AI scoring up to date");
  const [showDealWorkspace, setShowDealWorkspace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => opportunities.filter(o => (tier === "All" || o.tier === tier) && `${o.name} ${o.account} ${o.source} ${o.partner}`.toLowerCase().includes(query.toLowerCase())), [opportunities, query, tier]);
  const stats = useMemo(() => ({ pipeline: opportunities.reduce((sum, o) => sum + o.amount, 0), hot: opportunities.filter(o => o.tier === "Hot").reduce((sum, o) => sum + o.amount, 0), flags: opportunities.filter(o => o.flags?.length).length }), [opportunities]);
  const exportCsv = () => {
    const headings = ["Salesforce Opportunity ID", "Opportunity Score", "Priority Tier", "AI Confidence", "Hard Stop Flags", "Score Date"];
    const body = filtered.map(o => [o.id, o.score, o.tier, o.confidence, (o.flags || []).join("; "), new Date().toISOString().slice(0, 10)]);
    const csv = [headings, ...body].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "ilmas-route-to-revenue-salesforce-update.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const rows = parseCsv(await file.text()); const imported = rows.map(scoreFromRow);
    setOpportunities(current => {
      const map = new Map(current.map(o => [o.id, o])); imported.forEach(o => map.set(o.id, o)); return [...map.values()].sort((a, b) => b.score - a.score);
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
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity, scoringModel: categories }) });
      if (response.ok) {
        const ai = await response.json(); const overall = Math.round(Number(ai.overallScore));
        opportunity = { ...opportunity, score: overall, tier: tierFromScore(overall), confidence: ai.confidence || "Medium", flags: ai.flags || opportunity.flags };
      }
    } catch { /* The deterministic qualification score remains available if AI is temporarily unavailable. */ }
    setOpportunities(current => [opportunity, ...current].sort((a, b) => b.score - a.score));
    setNotice(`Scored ${opportunity.name}`); setShowDealWorkspace(false); setActive(opportunity);
  };
  const rescoreOpportunity = async (opportunity: Opportunity, categoryRatings: Record<string, number>, notes: string) => {
    setNotice(`Re-scoring ${opportunity.name} with your updates…`);
    let updated = opportunity;
    try {
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, manualCategoryRatings: categoryRatings, qualificationNotes: notes }, scoringModel: categories }) });
      if (response.ok) {
        const ai = await response.json(); const overall = Math.round(Number(ai.overallScore));
        const categoryScores = Object.fromEntries((ai.categoryScores || []).map((item: { category: string; rating: number; rationale: string; evidence: string[]; missingInformation: string[]; hardStop: boolean }) => [item.category, item]));
        updated = { ...opportunity, score: overall, tier: tierFromScore(overall), confidence: ai.confidence || opportunity.confidence, flags: ai.flags || opportunity.flags, changed: overall - opportunity.score, analysis: { rationale: ai.rationale || "", categoryScores }, dealData: { ...opportunity.dealData, qualificationNotes: notes, ...Object.fromEntries(Object.entries(categoryRatings).map(([key, value]) => [`qualification:${key}`, String(value)])) } };
      }
    } catch { /* Preserve the user's category changes even if the AI service is momentarily unavailable. */ }
    setOpportunities(list => list.map(item => item.id === opportunity.id ? updated : item));
    setActive(updated); setNotice(`Updated score for ${updated.name}`);
  };
  return <main>
    <header className="topbar"><div className="brand"><span className="brand-mark">I</span><span>Ilma&apos;s Route to Revenue</span></div><nav><a className="active">Opportunities</a><a>Imports</a><a>Activity</a><a>Settings</a></nav><div className="top-actions"><span className="sync"><span className="sync-dot" />{notice}</span><button className="avatar">IC</button></div></header>
    <section className="shell">
      <div className="eyebrow"><Sparkles size={15}/> AI-assisted opportunity prioritization</div>
      <div className="heading-row"><div><h1>Route to Revenue</h1><p>Know exactly where to focus next.</p></div><div className="actions"><button className="btn secondary" onClick={() => setShowSettings(true)}><Settings2 size={16}/> Scoring model</button><button className="btn secondary" onClick={exportCsv}><ArrowDownToLine size={16}/> Export to Salesforce</button><button className="btn secondary" onClick={() => setShowDealWorkspace(true)}><Plus size={16}/> Add deal</button><button className="btn primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Upload report</button></div></div>
      <section className="metrics"><div className="metric"><span>Active pipeline</span><strong>{money.format(stats.pipeline)}</strong><small>6 opportunities scored</small></div><div className="metric"><span>Hot opportunities</span><strong>{money.format(stats.hot)}</strong><small className="positive">2 deals ready for focus</small></div><div className="metric"><span>Qualification gaps</span><strong>{stats.flags}</strong><small className="warning-text">Need validation before advance</small></div><div className="metric score-card"><span>Scoring health</span><strong>86%</strong><div className="progress"><i /></div><small>High confidence across active pipeline</small></div></section>
      <section className="table-card"><div className="table-toolbar"><div className="table-title"><h2>Ranked opportunities</h2><span>{filtered.length} active</span></div><div className="toolbar-controls"><label className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search opportunities" /></label><button className="icon-btn"><Filter size={16}/></button><button className="icon-btn"><SlidersHorizontal size={16}/></button></div></div>
        <div className="tier-filter">{(["All", "Hot", "Work", "Nurture", "Deprioritize"] as const).map(item => <button key={item} className={tier === item ? "selected" : ""} onClick={() => setTier(item)}>{item === "All" ? "All opportunities" : <><i className={`dot ${item.toLowerCase()}`} />{item}</>}</button>)}</div>
        <div className="table-wrap"><table><thead><tr><th>Opportunity <ChevronDown size={13}/></th><th>Score</th><th>Amount</th><th>Stage</th><th>Close date</th><th>Source</th><th>Partner</th><th>Next step</th><th>Last score</th><th /></tr></thead><tbody>{filtered.map(o => <Fragment key={o.id}><tr className={active?.id === o.id ? "expanded" : ""} onClick={() => setActive(current => current?.id === o.id ? null : o)}><td><strong>{o.name}</strong><span>{o.account} · {o.owner}</span></td><td><div className="score-cell"><b className={`score ${o.tier.toLowerCase()}`}>{o.score}</b><span>{o.tier}</span></div></td><td><strong>{money.format(o.amount)}</strong><span>{o.forecast}</span></td><td><span className="stage">{o.stage}</span></td><td>{o.closeDate}</td><td>{o.source}</td><td>{o.partner}</td><td className="next"><strong>{o.nextStep}</strong><span>{o.nextStepDate}</span></td><td><span className={o.changed >= 0 ? "change up" : "change down"}>{o.changed >= 0 ? "+" : ""}{o.changed} pts</span><span>{o.confidence} confidence</span></td><td><button className="row-menu" aria-label="More actions"><MoreHorizontal size={17}/></button></td></tr>{active?.id === o.id && <OpportunityDrilldown opportunity={active} onClose={() => setActive(null)} onRescore={rescoreOpportunity} onOverride={(value) => { setOpportunities(list => list.map(item => item.id === active.id ? { ...item, score: value, tier: tierFromScore(value), changed: value - item.score } : item)); setActive({ ...active, score: value, tier: tierFromScore(value) }); }} />}</Fragment>)}</tbody></table></div>
      </section>
    </section>
    {showUpload && <div className="overlay"><section className="modal upload-modal"><button className="close" onClick={() => setShowUpload(false)}><X size={19}/></button><div className="modal-icon"><Upload size={23}/></div><h2>Upload Salesforce report</h2><p>Upload an Opportunity Report CSV. We&apos;ll detect the Salesforce fields, preserve existing opportunities, and score only records that changed.</p><button className="dropzone" onClick={() => input.current?.click()}><Upload size={22}/><strong>Choose a CSV report</strong><span>Salesforce Opportunity Report export · CSV only</span></button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/><div className="modal-note"><Bot size={15}/> AI analysis uses only approved mapped columns. You&apos;ll be able to review those columns before your first production import.</div></section></div>}
    {showDealWorkspace && <DealWorkspace onClose={() => setShowDealWorkspace(false)} onSave={addManualDeal} />}
    {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
  </main>;
}

function OpportunityDrilldown({ opportunity, onClose, onOverride, onRescore }: { opportunity: Opportunity; onClose: () => void; onOverride: (value: number) => void; onRescore: (opportunity: Opportunity, ratings: Record<string, number>, notes: string) => void }) {
  const [editing, setEditing] = useState(false); const [score, setScore] = useState(opportunity.score); const [reason, setReason] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(categories.map(([label], index) => [String(label), Math.max(2, 5 - (index % 3))])));
  const [notes, setNotes] = useState("");
  return <tr className="drilldown-row"><td colSpan={10}><div className="drilldown"><div className="panel-head"><div><span className="eyebrow"><Bot size={14}/> AI score · {opportunity.confidence} confidence</span><h2>{opportunity.name}</h2><p>{opportunity.account} · {money.format(opportunity.amount)} · {opportunity.stage}</p></div><button className="drilldown-close" onClick={onClose}>Close <X size={17}/></button></div><div className="panel-score"><div><span>Overall score</span><strong>{opportunity.score}</strong><b className={`tier-badge ${opportunity.tier.toLowerCase()}`}>{opportunity.tier}</b></div><p>Review the qualification inputs below. Your updates become evidence for the next AI score run.</p></div>{opportunity.flags?.length ? <div className="alert"><CircleAlert size={17}/><div><strong>Qualification gap</strong><span>{opportunity.flags.join(" · ")}</span></div></div> : null}<section className="explanation"><h3>Scoring rationale</h3><p>The AI uses the imported deal context plus the qualification detail below. Category ratings are editable and preserved in the next re-score request.</p><div className="evidence"><span>Evidence used</span><b>Opportunity description</b><b>Next step</b><b>Partner field</b></div></section><section className="category-list"><div className="category-header"><div><h3>Full category detail</h3><p>1 = weak or absent · 3 = partially validated · 5 = strong, confirmed evidence</p></div><button className="btn primary rescore" onClick={() => onRescore(opportunity, ratings, notes)}><Sparkles size={15}/> Re-score</button></div>{categories.map(([label, weight]) => <div className="category editable" key={String(label)}><div><strong>{label}</strong><span>Weight {weight}%</span></div><div className="rating"><select aria-label={`${label} rating`} value={ratings[String(label)]} onChange={e => setRatings(current => ({ ...current, [String(label)]: Number(e.target.value) }))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select><i style={{ width: `${ratings[String(label)] * 20}%` }} /></div></div>)}<label className="qualification-notes">Qualification notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add what you learned about budget, buyer access, timing, competition, procurement, partners, or relationships…" /></label></section><section className="override"><button className="btn secondary" onClick={() => setEditing(!editing)}>Override overall score</button>{editing && <div className="override-form"><label>New score<input type="number" min="0" max="100" value={score} onChange={e => setScore(Number(e.target.value))}/></label><label>Reason <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Required to preserve the scoring audit trail" /></label><button disabled={!reason.trim()} className="btn primary" onClick={() => { onOverride(score); setEditing(false); }}>Save override</button></div>}</section></div></td></tr>;
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  return <div className="overlay"><section className="modal settings-modal"><button className="close" onClick={onClose}><X size={19}/></button><div className="eyebrow"><Settings2 size={15}/> Shared scoring model</div><h2>Qualification model</h2><p>Weights total 100 points. Changes create a new version and automatically re-score active opportunities.</p><div className="settings-list">{categories.map(([name, weight]) => <div key={String(name)}><strong>{name}</strong><label><input defaultValue={String(weight)} type="number"/>%</label></div>)}</div><div className="settings-footer"><span>Version 1.0 · Last updated today</span><button className="btn primary" onClick={onClose}>Save and re-score</button></div></section></div>;
}

function DealWorkspace({ onClose, onSave }: { onClose: () => void; onSave: (deal: Omit<Opportunity, "score" | "tier" | "changed" | "confidence">) => void }) {
  const [data, setData] = useState<DealData>(() => ({ ...defaultDealData(), stage: "Qualification", forecast: "Pipeline", source: "Manual", probability: "10" }));
  const [ratings, setRatings] = useState(defaultRatings); const [analysis, setAnalysis] = useState<ScoreAnalysis | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"ready" | "scoring" | "error">("ready");
  const update = (key: string, value: string) => setData(current => ({ ...current, [key]: value }));
  const opportunityFromForm = (): Opportunity => {
    const amount = Number((data.amount || "").replace(/[^0-9.-]/g, "")) || 0;
    const score = Math.round(categories.reduce((sum, [label, weight]) => sum + (ratings[String(label)] / 5) * Number(weight), 0));
    return { id: data.salesforceId || `manual-${Date.now()}`, name: data.name || "Untitled opportunity", account: data.account || "Unassigned account", amount, closeDate: data.closeDate || "Not provided", stage: data.stage || "Qualification", forecast: data.forecast || "Pipeline", owner: data.owner || "Unassigned", source: data.source || "Manual", partner: data.partner || "—", nextStep: data.nextStep || "Validate qualification", nextStepDate: data.nextStepDate || "—", score, tier: tierFromScore(score), changed: 0, confidence: "Medium", dealData: data };
  };
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setStatus("scoring"); const opportunity = opportunityFromForm();
      try {
        const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, salesforceFields: data, manualCategoryRatings: ratings, qualificationNotes: data.qualificationNotes || "" }, scoringModel: categories }) });
        if (!response.ok) throw new Error("Scoring failed");
        const ai = await response.json();
        setAnalysis({ rationale: ai.rationale || "Analysis is ready.", categoryScores: Object.fromEntries((ai.categoryScores || []).map((item: CategoryAnalysis & { category: string }) => [item.category, item])) });
        setStatus("ready");
      } catch { setStatus("error"); }
    }, 850);
    return () => window.clearTimeout(timer);
  // Scoring happens after the seller pauses typing, avoiding a request per keystroke.
  }, [data, ratings]);
  const submit = () => {
    if (!data.name.trim() || !data.account.trim()) return;
    const opportunity = opportunityFromForm();
    onSave({ ...opportunity, dealData: { ...data, qualificationNotes: data.qualificationNotes || "", ...Object.fromEntries(Object.entries(ratings).map(([key, value]) => [`qualification:${key}`, String(value)])) } });
  };
  const analysisFor = (label: string) => analysis?.categoryScores[label];
  return <section className="workspace"><div className="workspace-head"><div><div className="eyebrow"><Plus size={15}/> New opportunity</div><h1>Add a deal</h1><p>A dedicated working tab for Salesforce data, qualification evidence, and live analysis.</p></div><div className="workspace-actions"><span className={`workspace-status ${status}`}>{status === "scoring" ? "Updating analysis…" : status === "error" ? "Analysis will retry after your next update" : "Analysis up to date"}</span><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!data.name.trim() || !data.account.trim()} onClick={submit}>Add scored deal <ArrowUpRight size={16}/></button></div></div><div className="workspace-grid"><div className="workspace-form"><section className="form-card"><div className="section-title"><div><h2>Salesforce deal detail</h2><p>Enter the fields from the Opportunity record. Required fields are marked.</p></div></div><div className="deal-grid">{salesforceFields.map(([label, key, hint]) => <label key={key} className={key === "description" || key === "nextStep" ? "wide" : ""}>{label}{hint && <small>{hint}</small>}{key === "stage" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Prospecting", "Qualification", "Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(item => <option key={item}>{item}</option>)}</select> : key === "forecast" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Pipeline", "Best Case", "Commit", "Closed"].map(item => <option key={item}>{item}</option>)}</select> : key === "description" || key === "nextStep" ? <textarea value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "description" ? "Customer context, use case, scope, stakeholders…" : "What must happen next?"} /> : <input type={key === "closeDate" || key === "nextStepDate" ? "date" : key === "amount" || key === "probability" ? "number" : "text"} value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "amount" ? "0" : ""} />}</label>)}</div></section><section className="form-card"><div className="section-title"><div><h2>Deal qualification</h2><p>Every category starts collapsed. The title and score remain visible; open a group to update evidence and see its analysis.</p></div></div><div className="qualification-accordions">{qualificationFields.map(([label, key]) => { const item = analysisFor(label); const isOpen = !!openCategories[label]; const currentRating = item?.rating ?? ratings[label]; return <article className={`qualification-group ${isOpen ? "open" : ""}`} key={key}><button type="button" className="qualification-summary" onClick={() => setOpenCategories(current => ({ ...current, [label]: !current[label] }))}><span>{label}</span><b>{currentRating} / 5</b><ChevronDown size={17}/></button>{isOpen && <div className="qualification-content"><label>Seller-entered qualification evidence<textarea value={data[key] || ""} onChange={e => update(key, e.target.value)} placeholder={`Evidence for ${label.toLowerCase()}…`} /></label><label>Score<select value={ratings[label]} onChange={e => setRatings(current => ({ ...current, [label]: Number(e.target.value) }))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label><div className="category-analysis"><strong>Resulting analysis</strong><p>{item?.rationale || "Analysis will appear here after your update is scored."}</p>{item?.evidence?.length ? <p><b>Evidence used:</b> {item.evidence.join(" · ")}</p> : null}{item?.missingInformation?.length ? <small>Still needed: {item.missingInformation.join(" · ")}</small> : null}</div></div>}</article>; })}<label className="qualification-notes">Additional qualification notes<textarea value={data.qualificationNotes || ""} onChange={e => update("qualificationNotes", e.target.value)} placeholder="Budget, buyer access, timing, competition, procurement, relationships, or any other context…" /></label></div></section></div><aside className="analysis-card"><div className="analysis-score"><span>Live opportunity score</span><strong>{analysis ? Math.round(categories.reduce((sum, [label, weight]) => sum + ((analysisFor(String(label))?.rating ?? ratings[String(label)]) / 5) * Number(weight), 0)) : Math.round(categories.reduce((sum, [label, weight]) => sum + (ratings[String(label)] / 5) * Number(weight), 0))}</strong><b>{tierFromScore(analysis ? Math.round(categories.reduce((sum, [label, weight]) => sum + ((analysisFor(String(label))?.rating ?? ratings[String(label)]) / 5) * Number(weight), 0)) : Math.round(categories.reduce((sum, [label, weight]) => sum + (ratings[String(label)] / 5) * Number(weight), 0)))}</b></div><h2>Qualification analysis</h2><p className="analysis-intro">{analysis?.rationale || "Add deal information and evidence. Analysis updates automatically when you pause after a change."}</p><p className="analysis-hint">Open a category to view the data entered and its resulting analysis.</p></aside></div></section>;
}
