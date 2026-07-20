"use client";

import "./manual.css";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
    "qualification:Deal Size": strong ? "The expected contract value is $420,000, placing the opportunity in the highest-value target band." : developing ? "The expected contract value is approximately $150,000, within the standard target range." : "The expected contract value is below $100,000 or has not yet been validated.", "aiPoints:Deal Size": points(10),
    "qualification:Resource Requirements": strong ? "Standard configuration with limited services: approximately 20 implementation hours and normal customer-success coverage." : developing ? "Moderate implementation support is expected, including workflow configuration, training, and approximately 60 services hours." : "The likely scope requires custom integration, extensive services, and significant ongoing technical support.", "aiPoints:Resource Requirements": points(10, strong ? 0 : developing ? -1 : 0)
  };
}

const featuredSeed: Opportunity[] = [
  { id: "006A000001", name: "State of Colorado Department of Human Services - Enterprise Compliance Program", account: "State of Colorado Department of Human Services", score: 91, tier: "Hot", amount: 420000, closeDate: "Sep 30, 2026", stage: "Proposal", forecast: "Commit", owner: "Michael Jordan", source: "Partner", partner: "Carahsoft", nextStep: "Confirm final security language", nextStepDate: "Aug 8", changed: 6, confidence: "High", dealData: sampleQualification("State of Colorado Department of Human Services", "Carahsoft", 5) },
  { id: "006A000002", name: "City of Austin Information Security Office - Trust Management Expansion", account: "City of Austin Information Security Office", score: 84, tier: "Hot", amount: 185000, closeDate: "Aug 31, 2026", stage: "Negotiation", forecast: "Best Case", owner: "Shohei Ohtani", source: "Outbound", partner: "—", nextStep: "Economic buyer review", nextStepDate: "Aug 5", changed: 4, confidence: "High", dealData: sampleQualification("City of Austin Information Security Office", "—", 4) },
  { id: "006A000003", name: "University of Michigan Office of Information Assurance - Security Automation Program", account: "University of Michigan Office of Information Assurance", score: 72, tier: "Work", amount: 250000, closeDate: "Nov 15, 2026", stage: "Discovery", forecast: "Pipeline", owner: "Jerry Rice", source: "Event", partner: "Deloitte", nextStep: "Map procurement vehicle", nextStepDate: "Aug 13", changed: -3, confidence: "Medium", flags: ["No Procurement Path"], dealData: sampleQualification("University of Michigan Office of Information Assurance", "Deloitte", 3) },
  { id: "006A000004", name: "Harris County Office of Technology Services - Vendor Risk Management", account: "Harris County Office of Technology Services", score: 66, tier: "Work", amount: 148000, closeDate: "Dec 18, 2026", stage: "Qualification", forecast: "Pipeline", owner: "Alexander Ovechkin", source: "Inbound", partner: "—", nextStep: "Validate funding source", nextStepDate: "Aug 11", changed: 2, confidence: "Medium", flags: ["Budget Not Confirmed"], dealData: sampleQualification("Harris County Office of Technology Services", "—", 3) },
  { id: "006A000005", name: "Virginia Department of Health - Continuous Compliance Pilot", account: "Virginia Department of Health", score: 53, tier: "Nurture", amount: 95000, closeDate: "Jan 30, 2027", stage: "Discovery", forecast: "Pipeline", owner: "Michael Phelps", source: "Partner", partner: "Guidehouse", nextStep: "Schedule technical discovery", nextStepDate: "Aug 20", changed: 0, confidence: "Low", flags: ["No Compelling Event"], dealData: sampleQualification("Virginia Department of Health", "Guidehouse", 2) },
  { id: "006A000006", name: "City of Phoenix Department of Public Safety - Risk Operations Modernization", account: "City of Phoenix Department of Public Safety", score: 32, tier: "Deprioritize", amount: 120000, closeDate: "Mar 31, 2027", stage: "Prospecting", forecast: "Pipeline", owner: "Michael Jordan", source: "Outbound", partner: "—", nextStep: "Reconnect after budget cycle", nextStepDate: "Oct 1", changed: -5, confidence: "Low", flags: ["No Executive Sponsor", "Stale Next Step"], dealData: sampleQualification("City of Phoenix Department of Public Safety", "—", 1) }
];

const accountNames = [
  "Florida Department of Children and Families","California Department of Health Care Services","Texas Health and Human Services Commission","New York State Office of Information Technology Services","Georgia Department of Revenue","Ohio Department of Administrative Services","Arizona Department of Public Safety","Oregon Department of Transportation","Maryland Department of Human Services","Minnesota Management and Budget","Nevada Division of Enterprise IT Services","Virginia Department of Behavioral Health","Colorado Office of the State Auditor","North Carolina Department of Commerce","Washington State Department of Licensing","Tennessee Department of Finance and Administration","Massachusetts Executive Office of Technology Services","Michigan Department of Insurance and Financial Services","Wisconsin Department of Workforce Development","Pennsylvania Office of Administration",
  "City of Tampa Technology and Innovation Department","City of Austin Information Security Office","City of Denver Department of Public Safety","City of Seattle Finance and Administrative Services","City of Boston Department of Innovation and Technology","City of Phoenix Information Technology Services","City of Nashville Metro Finance Department","City of Raleigh Procurement Division","City of Charlotte Risk Management Office","City of San Diego Department of Information Technology","City of Atlanta Office of Enterprise Risk Management","City of Portland Bureau of Technology Services","City of Columbus Department of Public Service","City of Las Vegas Innovation and Technology","City of New Orleans Office of Homeland Security",
  "Harris County Universal Services","Cook County Bureau of Technology","Maricopa County Office of Enterprise Technology","King County Department of Executive Services","Fairfax County Department of Information Technology","Los Angeles County Internal Services Department","Orange County Auditor-Controller","Miami-Dade County Strategic Procurement","Broward County Enterprise Technology Services","Allegheny County Department of Human Services","Fulton County Information Technology","Montgomery County Office of Management and Budget","Travis County Purchasing Office","Clark County Administrative Services","Wake County Finance Department",
  "University of Florida Office of Internal Audit","Georgia Tech Cyber Security Operations","Ohio State University Enterprise Risk Management","University of Michigan Information Assurance","Penn State University Procurement Services","University of Wisconsin System Administration","University of Texas System Audit Office","Arizona State University Research Administration","University of North Carolina Information Security Office","Florida State University Controller's Office","University of Washington Compliance and Risk Services","Virginia Tech Division of Information Technology","Rutgers University Institutional Compliance","University of Colorado System Administration","Michigan State University Internal Audit",
  "Hillsborough County Public Schools Information Technology","Miami-Dade County Public Schools Procurement Management","Fairfax County Public Schools Risk Management","Houston Independent School District Technology Services","Chicago Public Schools Internal Audit","Los Angeles Unified School District Procurement Services","Wake County Public School System Finance Division","Clark County School District Information Security","Broward County Public Schools Enterprise Risk","Austin Independent School District Technology Operations",
  "Metropolitan Atlanta Rapid Transit Authority","Washington Metropolitan Area Transit Authority","Port Authority of New York and New Jersey","Tampa International Airport Authority","Central Florida Expressway Authority","Los Angeles County Metropolitan Transportation Authority","Massachusetts Bay Transportation Authority","Dallas Area Rapid Transit","Miami-Dade Aviation Department","Port of Seattle","Orlando Utilities Commission","New York City Housing Authority","Chicago Housing Authority","Jacksonville Electric Authority","San Antonio Water System","California Public Employees' Retirement System","Teacher Retirement System of Texas","Florida Agency for Health Care Administration","Colorado Public Employees' Retirement Association"
];
const dealPrograms = ["Compliance Modernization Initiative","Digital Trust Expansion","Security Evidence Automation","Vendor Risk Transformation","Audit Readiness Accelerator","Continuous Controls Monitoring","Third-Party Risk Modernization","Evidence Collection Automation","Governance Platform Rollout","Risk Operations Upgrade","Cloud Compliance Program","Enterprise GRC Consolidation","Control Testing Automation","Regulatory Readiness Project","Security Questionnaire Automation","Policy Management Renewal","Public Records Risk Review","Identity Governance Expansion","Cyber Resilience Initiative","Supplier Assurance Program","Agency Trust Center Launch","Compliance Workflow Redesign","Audit Evidence Hub","Risk Intelligence Pilot","Continuous Authorization Program"];
const partnerNames = ["Carahsoft","Guidehouse","Deloitte","SHI","CDW-G","Presidio","Accenture","Optiv"];
const conferenceNames = ["NASCIO Annual Conference","GovTech Summit","Public Sector Cybersecurity Forum","State CIO Leadership Exchange","Digital Government Summit","National Association of State Auditors Conference"];
const sampleOwners = ["Michael Jordan", "Shohei Ohtani", "Jerry Rice", "Alexander Ovechkin", "Michael Phelps"];
const generatedCounts = { small:54, moderate:30, big:8, huge:2 } as const;
const generatedSeed: Opportunity[] = Object.entries(generatedCounts).flatMap(([segment,count],segmentIndex)=>Array.from({length:count},(_,index)=>{
  const sequence=featuredSeed.length+Object.values(generatedCounts).slice(0,segmentIndex).reduce((sum,value)=>sum+value,0)+index+1;
  const generatedIndex=sequence-featuredSeed.length-1; const account=accountNames[generatedIndex%accountNames.length];
  const amount=segment==="small"?20000+((index*13751)%80000):segment==="moderate"?110000+((index*31753)%390000):segment==="big"?525000+((index*97777)%675000):1950000+(index*125000);
  const surpriseHigh=segment==="small"&&index<8; const surpriseLow=(segment==="big"&&index<3)||(segment==="huge"&&index===0);
  const base=surpriseHigh?5:surpriseLow?1:1+((sequence*3)%5); const score=surpriseHigh?88+(index%8):surpriseLow?22+(index*4):Math.max(24,Math.min(94,Math.round(25+base*13+((sequence*11)%15))));
  const qualification=sampleQualification(account,"—",base); const dealSizePoints=segment==="small"?2:segment==="moderate"?6:segment==="big"?8:10;
  qualification["qualification:Deal Size"]=`Expected contract value is $${amount.toLocaleString("en-US")} in the ${segment} deal segment.`; qualification["aiPoints:Deal Size"]=String(dealSizePoints);
  const flags=score<45?[surpriseLow?"Large Deal With Weak Qualification":"Multiple Qualification Gaps"]:score<65?["Qualification Evidence Needed"]:undefined;
  const partner=partnerNames[sequence%partnerNames.length]; const nextDate=new Date(2026,7+(sequence%4),2+(sequence%25)).toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const nextStep=[`Meeting Scheduled With ${account} on ${nextDate}`,`Attend ${conferenceNames[sequence%conferenceNames.length]} With ${account} Team`,`Reach Out After ${account} Sponsor Returns From Vacation on ${nextDate}`,`Partner ${partner} Activities Planned With ${account} for ${nextDate}`,`Executive Value Review With ${account} Scheduled for ${nextDate}`,`Technical Validation Workshop for ${account} on ${nextDate}`,`Confirm Funding Approval With ${account} by ${nextDate}`,`Procurement Path Working Session With ${account} on ${nextDate}`][sequence%8];
  const source=generatedIndex<72?"Inbound":["Outbound","Event","Referral","Partner"][generatedIndex%4];
  return {id:`006S${String(sequence).padStart(6,"0")}`,name:`${account} - ${dealPrograms[sequence%dealPrograms.length]}`,account,score,tier:score>=80?"Hot":score>=60?"Work":score>=40?"Nurture":"Deprioritize",amount,closeDate:new Date(2026+(sequence%2),(sequence*5)%12,1+((sequence*7)%27)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),stage:["Prospecting","Qualification","Discovery","Proposal","Negotiation"][sequence%5],forecast:score>=80?"Commit":score>=60?"Best Case":"Pipeline",owner:sampleOwners[sequence%sampleOwners.length],source,partner:sequence%4===0?partner:"—",nextStep,nextStepDate:nextDate,changed:(sequence%11)-5,confidence:score>=78?"High":score>=52?"Medium":"Low",flags,dealData:qualification} as Opportunity;
}));
const seed: Opportunity[] = [...featuredSeed,...generatedSeed];

const formatOpportunityName = (account: string, dealName: string) => {
  const customer = account.trim() || "Unassigned Customer"; const deal = dealName.trim() || "Untitled Deal";
  return deal.startsWith(`${customer} - `) ? deal : `${customer} - ${deal}`;
};

const categories = [
  ["Pain And Urgency", 10], ["Budget And Funding Confidence", 10], ["Deal Size", 10], ["Resource Requirements", 10],
  ["Ideal Customer Fit", 8], ["Executive Sponsor", 8], ["Timing / Compelling Event", 8], ["Strategic Value", 7],
  ["Engagement / Activity", 6], ["Procurement Path", 6], ["Existing Relationships", 5], ["Solution Fit", 4],
  ["Value Proposition", 4], ["Competitive Position", 4]
];

const categoryGuidance: Record<string,{expected:string;methodology:string}> = {
  "Pain And Urgency": { expected:"Document the business problem, measurable impact, consequences of delay, and why action is required now.", methodology:"No evidence earns 20% of available points. Higher points require quantified pain, customer validation, and urgent consequences." },
  "Budget And Funding Confidence": { expected:"Identify the budget amount, funding source, fiscal period, approval status, and accountable budget owner.", methodology:"Points increase from an unconfirmed funding hypothesis to customer-confirmed, approved funding within the purchase window." },
  "Deal Size": { expected:"Enter the expected contract value or annual contract value and note whether the amount has been validated with the customer.", methodology:"Larger, customer-validated opportunities earn more points. Unvalidated or missing values receive the minimum evidence score." },
  "Resource Requirements": { expected:"Estimate implementation, services, integration, support, and internal delivery effort needed to win and serve the customer.", methodology:"This is inverse scored: low, standard effort earns high points; extensive custom work and ongoing support earn fewer points." },
  "Ideal Customer Fit": { expected:"Describe industry, organization size, compliance maturity, use case, geography, and other ICP attributes.", methodology:"Points reflect the number and strength of validated ICP matches. Generic firmographic data alone is insufficient for full points." },
  "Executive Sponsor": { expected:"Name the accountable executive sponsor, their authority, engagement level, and the team’s access path.", methodology:"Full points require an engaged executive with decision authority. A champion without executive access earns partial points." },
  "Timing / Compelling Event": { expected:"Document a specific deadline, mandate, audit, renewal, fiscal event, or consequence that creates a purchase window.", methodology:"Immovable, customer-confirmed events earn the most points; general timing intentions or seller dates earn fewer." },
  "Strategic Value": { expected:"Describe expansion potential, reference value, market significance, cross-sell paths, or strategic learning.", methodology:"Points increase with specific, credible downstream value beyond the initial transaction." },
  "Engagement / Activity": { expected:"Summarize meetings, responsiveness, stakeholder participation, shared materials, and recent customer actions.", methodology:"Recent, reciprocal, multi-stakeholder activity earns high points; one-way outreach and stale activity earn low points." },
  "Procurement Path": { expected:"Identify procurement owners, contract vehicle, legal and security reviews, approval sequence, and target award process.", methodology:"A confirmed, navigable purchase process earns full points. Unknown steps, owners, or vehicles reduce the score." },
  "Existing Relationships": { expected:"Describe trusted relationships with champions, executives, procurement, technical teams, and other stakeholders.", methodology:"Breadth, trust, influence, and relevance of existing relationships determine the score." },
  "Solution Fit": { expected:"Map customer requirements and use cases to confirmed product capabilities, integrations, and constraints.", methodology:"Validated fit across critical requirements earns high points; assumptions and unresolved technical gaps reduce points." },
  "Value Proposition": { expected:"Document customer-validated outcomes, quantified benefits, ROI, risk reduction, or operational improvement.", methodology:"Quantified and customer-confirmed value earns full points; generic benefits or seller-only estimates earn partial points." },
  "Competitive Position": { expected:"Identify alternatives, incumbent solutions, evaluation criteria, differentiation, and customer preference.", methodology:"A validated preferred position earns high points; unknown competition or untested differentiation earns low points." }
};

const categoryActions: Record<string,(opportunity:Opportunity)=>string> = {
  "Pain And Urgency": opportunity=>`Quantify the cost and consequence of delay with ${opportunity.account}.`,
  "Budget And Funding Confidence": opportunity=>`Confirm the funding source, approval status, and budget owner at ${opportunity.account}.`,
  "Deal Size": opportunity=>`Validate the ${money.format(opportunity.amount)} expected contract value with the customer.`,
  "Resource Requirements": opportunity=>`Complete a delivery-effort review and identify ways to reduce implementation resources.`,
  "Ideal Customer Fit": opportunity=>`Validate the priority use case and ICP fit with ${opportunity.account}.`,
  "Executive Sponsor": opportunity=>`Secure a meeting with an executive sponsor who has decision authority.`,
  "Timing / Compelling Event": opportunity=>`Identify and confirm a customer-owned deadline or compelling event.`,
  "Strategic Value": opportunity=>`Document the expansion, reference, or cross-agency value of this opportunity.`,
  "Engagement / Activity": opportunity=>`Create a reciprocal engagement plan with named customer stakeholders.`,
  "Procurement Path": opportunity=>`Map the contract vehicle, approvals, security review, and procurement owner.`,
  "Existing Relationships": opportunity=>`Expand relationships beyond the current contact to technical, executive, and procurement stakeholders.`,
  "Solution Fit": opportunity=>`Schedule technical validation for the customer’s critical requirements and integrations.`,
  "Value Proposition": opportunity=>`Build a quantified value case and validate it with the customer.`,
  "Competitive Position": opportunity=>`Identify the incumbent and alternatives, then validate differentiation with the customer.`
};

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
  "Deal Size": ["Deal size", "Expected deal size"], "Resource Requirements": ["Resource requirements"]
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
  const owner = sampleOwners[Math.abs([...opportunity.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)) % sampleOwners.length];
  return { ...opportunity, name: formatOpportunityName(opportunity.account, opportunity.name), owner, dealData, analysis: opportunity.analysis ? { ...opportunity.analysis, categoryScores } : undefined };
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const tierFromScore = (score: number): Tier => score >= 80 ? "Hot" : score >= 60 ? "Work" : score >= 40 ? "Nurture" : "Deprioritize";
const suggestedNextSteps=(opportunity:Opportunity,model:(string|number)[][])=>{
  const ranked=model.map(([rawLabel,rawMaximum])=>{const label=String(rawLabel),maximum=Number(rawMaximum);const analyzed=opportunity.analysis?.categoryScores[label]?.points;const stored=Number(opportunity.dealData?.[`aiPoints:${label}`]);const points=analyzed??(Number.isFinite(stored)?stored:maximum*.2);return {label,ratio:maximum?points/maximum:1};}).sort((a,b)=>a.ratio-b.ratio);
  const recommendations=ranked.slice(0,3).map(item=>(categoryActions[item.label]||((deal:Opportunity)=>`Validate the missing ${item.label.toLowerCase()} evidence with ${deal.account}.`))(opportunity));
  return [...new Set(recommendations)].slice(0,3);
};

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
    "Existing Relationships": ["Existing Relationship", "Existing Relationships"], "Deal Size": ["Deal Size", "Amount", "Annual Contract Value", "ACV"],
    "Resource Requirements": ["Resource Requirements", "Resource Needs", "Implementation Effort", "Delivery Effort", "Services Required"]
  };
  Object.entries(aliases).forEach(([label, names]) => { dealData[`qualification:${label}`] = pick(...names); });
  return {
    id: pick("Opportunity ID", "Id", "ID") || `import-${index + 1}`,
    name: formatOpportunityName(pick("Account Name", "Account") || "Unmapped Account", pick("Opportunity Name", "Name") || `Imported Opportunity ${index + 1}`),
    account: pick("Account Name", "Account") || "Unmapped account", score, tier: tierFromScore(score), amount,
    closeDate: pick("Close Date", "CloseDate") || "Not provided", stage,
    forecast: pick("Forecast Category", "ForecastCategoryName") || "Pipeline",
    owner: sampleOwners[index % sampleOwners.length], source: pick("Lead Source", "LeadSource") || "—",
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
  const isSoleAdmin=userEmail.trim().toLowerCase()==="knutesteel@gmail.com";
  const [opportunities, setOpportunities] = useState<Opportunity[]>(seed.map(normalizeOpportunity));
  const [query, setQuery] = useState(""); const [tier, setTier] = useState<"All" | Tier>("All");
  const [stageFilter, setStageFilter] = useState("All"); const [ownerFilter, setOwnerFilter] = useState("All");
  const [currentModel, setCurrentModel] = useState(categories);
  const [lifecycleFilter, setLifecycleFilter] = useState("active"); const [dealSizeFilter,setDealSizeFilter]=useState("All");
  const [sortBy, setSortBy] = useState<"name"|"score"|"amount"|"stage"|"closeDate"|"source"|"nextStep"|"changed">("score"); const [sortDirection,setSortDirection]=useState<"asc"|"desc">("desc");
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]); const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState(isSoleAdmin?"admin":"member"); const [loadingData, setLoadingData] = useState(true);
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
      const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspace).eq("user_id",(await supabase.auth.getClaims()).data?.claims?.sub).maybeSingle();
      setRole(membership?.role || (isSoleAdmin?"admin":"member"));
      await supabase.rpc("log_session_activity", { activity: "sign_in" });
      const { data, error } = await supabase.from("opportunities").select("*, score_runs(*)").eq("workspace_id", workspace).order("updated_at", { ascending: false });
      if (error) { setNotice(error.message); setLoadingData(false); return; }
      if (!data?.length) {
        const rows = seed.map(item => ({ workspace_id: workspace, salesforce_opportunity_id: item.id, source_data: item, lifecycle: "active", last_scored_at: new Date().toISOString() }));
        const { data: inserted } = await supabase.from("opportunities").upsert(rows, { onConflict: "workspace_id,salesforce_opportunity_id" }).select("id, salesforce_opportunity_id, updated_at");
        const ids = new Map((inserted || []).map(row => [row.salesforce_opportunity_id, row]));
        setOpportunities(seed.map(item => normalizeOpportunity({ ...item, dbId: ids.get(item.id)?.id, lifecycle: "active", updatedAt: ids.get(item.id)?.updated_at })));
      } else {
        const existingIds=new Set(data.map(row=>row.salesforce_opportunity_id)); const missing=seed.filter(item=>!existingIds.has(item.id));
        let added:Opportunity[]=[];
        if(missing.length){const rows=missing.map(item=>({workspace_id:workspace,salesforce_opportunity_id:item.id,source_data:item,lifecycle:"active",last_scored_at:new Date().toISOString()}));const {data:inserted}=await supabase.from("opportunities").insert(rows).select("id,salesforce_opportunity_id,updated_at");const ids=new Map((inserted||[]).map(row=>[row.salesforce_opportunity_id,row]));added=missing.map(item=>normalizeOpportunity({...item,dbId:ids.get(item.id)?.id,lifecycle:"active",updatedAt:ids.get(item.id)?.updated_at}));}
        const latestSamples=new Map(seed.map(item=>[item.id,item]));
        const existing=data.map(row => { const sample=latestSamples.get(row.salesforce_opportunity_id); const stored=row.source_data as Opportunity; const source=sample?{...sample,...stored,dealData:{...sample.dealData,...stored.dealData}}:stored; return normalizeOpportunity({ ...source, dbId: row.id, lifecycle: row.lifecycle, updatedAt: row.updated_at, lastScoredAt: row.last_scored_at, history: (row.score_runs || []).sort((a: ScoreHistory, b: ScoreHistory) => b.created_at.localeCompare(a.created_at)) }); });
        setOpportunities([...existing,...added].sort((a,b)=>b.score-a.score));
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
  const filtered = useMemo(() => { const sizeMatches=(o:Opportunity)=>dealSizeFilter==="All"||(dealSizeFilter==="Small"&&o.amount<100000)||(dealSizeFilter==="Moderate"&&o.amount>=100000&&o.amount<500000)||(dealSizeFilter==="Big"&&o.amount>=500000&&o.amount<1500000)||(dealSizeFilter==="Huge"&&o.amount>=1500000); const value=(o:Opportunity)=>sortBy==="name"?o.name.toLowerCase():sortBy==="amount"?o.amount:sortBy==="stage"?o.stage.toLowerCase():sortBy==="closeDate"?(Date.parse(o.closeDate)||0):sortBy==="source"?o.source.toLowerCase():sortBy==="nextStep"?o.nextStep.toLowerCase():sortBy==="changed"?o.changed:o.score; return opportunities.filter(o => sizeMatches(o)&&(!showGapsOnly || Boolean(o.flags?.length)) && (tier === "All" || o.tier === tier) && (stageFilter === "All" || o.stage === stageFilter) && (ownerFilter === "All" || o.owner === ownerFilter) && (lifecycleFilter === "All" || (o.lifecycle || "active") === lifecycleFilter) && `${o.name} ${o.account} ${o.source} ${o.partner}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{const av=value(a),bv=value(b);const result=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv));return sortDirection==="asc"?result:-result;}); }, [opportunities, query, tier, stageFilter, ownerFilter, lifecycleFilter, dealSizeFilter, sortBy, sortDirection, showGapsOnly]);
  const activeOpportunities = opportunities.filter(o => (o.lifecycle || "active") === "active");
  const stats = useMemo(() => { const scored = activeOpportunities.filter(o => o.lastScoredAt || o.score); const high = scored.filter(o => o.confidence === "High").length; return { pipeline: activeOpportunities.reduce((sum, o) => sum + o.amount, 0), hot: activeOpportunities.filter(o => o.tier === "Hot").reduce((sum, o) => sum + o.amount, 0), hotCount: activeOpportunities.filter(o => o.tier === "Hot").length, flags: activeOpportunities.filter(o => o.flags?.length).length, health: scored.length ? Math.round((high / scored.length) * 100) : 0 }; }, [opportunities]);
  const impactfulNextSteps=useMemo(()=>activeOpportunities.map(opportunity=>({opportunity,step:suggestedNextSteps(opportunity,currentModel)[0],impact:opportunity.amount*(.35+(100-opportunity.score)/100)+(opportunity.flags?.length||0)*50000})).filter(item=>item.step).sort((a,b)=>b.impact-a.impact).slice(0,5),[opportunities,currentModel]);
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
  const rescoreOpportunity = async (opportunity: Opportunity, categoryPoints: Record<string, number>, notes: string): Promise<{ok:boolean;message:string}> => {
    setNotice(`Re-scoring ${opportunity.name} with your updates…`);
    let updated: Opportunity = { ...opportunity, dealData: { ...opportunity.dealData, qualificationNotes: notes, ...Object.fromEntries(Object.entries(categoryPoints).map(([key, value]) => [`manualPoints:${key}`, String(value)])) } };
    let scoringError = "";
    try {
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, manualCategoryPoints: categoryPoints, qualificationNotes: notes }, scoringModel: currentModel }) });
      if (response.ok) {
        const ai = await response.json(); const overall = Math.round(Number(ai.overallScore));
        const categoryScores = Object.fromEntries((ai.categoryScores || []).map((item: CategoryAnalysis & { category: string }) => [item.category, item]));
        updated = { ...updated, score: overall, tier: tierFromScore(overall), confidence: ai.confidence || opportunity.confidence, flags: ai.flags || opportunity.flags, changed: overall - opportunity.score, analysis: { rationale: ai.rationale || "", categoryScores }, dealData: { ...updated.dealData, ...Object.fromEntries(Object.entries(categoryScores).map(([key, value]) => [`aiPoints:${key}`, String((value as CategoryAnalysis).points)])) } };
      } else { const error=await response.json().catch(()=>null); scoringError=error?.error||`Scoring service returned ${response.status}`; }
    } catch (error) { scoringError=error instanceof Error?error.message:"Scoring service is temporarily unavailable"; }
    updated = await persistOpportunity({ ...updated, lastScoredAt: new Date().toISOString() });
    await recordScore(updated, "manual", updated.analysis || {});
    setOpportunities(list => list.map(item => item.id === opportunity.id ? updated : item));
    setActive(updated);
    const message=scoringError?`Changes saved. AI re-score could not complete: ${scoringError}`:`Changes saved and score updated to ${updated.score}`;
    setNotice(message);
    return {ok:!scoringError,message};
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
    for (const item of targets) await rescoreOpportunity(item, Object.fromEntries(currentModel.flatMap(([label]) => { const raw=item.dealData?.[`manualPoints:${String(label)}`]; const value=Number(raw); return raw!==undefined&&raw!==""&&Number.isFinite(value)?[[String(label),value]]:[]; })), item.dealData?.qualificationNotes || "");
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
    if (!model.length || model.some(item=>!String(item[0]).trim()||Number(item[1])<0)||model.reduce((sum,item)=>sum+Number(item[1]),0)!==100) { setNotice("Category points must be valid and total exactly 100"); return false; }
    const sorted=[...model].sort((a,b)=>Number(b[1])-Number(a[1]));
    if (configured && workspaceId) {
      const supabase=createClient(); const {data:claims}=await supabase.auth.getClaims(); const {data:latest}=await supabase.from("scoring_models").select("version").eq("workspace_id",workspaceId).order("version",{ascending:false}).limit(1).maybeSingle();
      const {error}=await supabase.from("scoring_models").insert({workspace_id:workspaceId,version:(latest?.version||0)+1,model:sorted,created_by:claims?.claims?.sub}); if(error){setNotice(error.message);return false;}
    }
    setCurrentModel(sorted); setNotice("Scoring model saved; active opportunities are being re-scored");
    for (const item of activeOpportunities) await rescoreOpportunity(item,Object.fromEntries(sorted.flatMap(([label])=>{const raw=item.dealData?.[`manualPoints:${String(label)}`];const value=Number(raw);return raw!==undefined&&raw!==""&&Number.isFinite(value)?[[String(label),value]]:[]})),item.dealData?.qualificationNotes||"");
    return true;
  };
  const toggleSort=(column:typeof sortBy)=>{if(sortBy===column)setSortDirection(current=>current==="asc"?"desc":"asc");else{setSortBy(column);setSortDirection(column==="name"||column==="stage"||column==="source"||column==="nextStep"?"asc":"desc");}};
  const SortHeader=({column,children}:{column:typeof sortBy;children:ReactNode})=><button className="sort-header" onClick={()=>toggleSort(column)}>{children}<ChevronDown size={13} className={sortBy===column?sortDirection:""}/></button>;
  return <main>
    <header className="topbar"><div className="brand"><img className="brand-logo" src="/ilma-logo.png" alt="Ilma llama logo"/><span>Ilma&apos;s Route to Revenue</span></div><nav><a className={!showActivity?"active":""} onClick={()=>setShowActivity(false)}>Opportunities</a><a onClick={() => setShowSettings(true)}>Settings</a>{role==="admin"&&<a className={showActivity?"active":""} onClick={openActivity}>Admin</a>}</nav><div className="top-actions"><span className="sync"><span className="sync-dot" />{loadingData ? "Loading workspace…" : notice}</span><span className="user-email">{userEmail}{role==="admin"?" · Admin":""}</span><button className="icon-btn" onClick={logout} aria-label="Sign out"><LogOut size={16}/></button></div></header>
    {showActivity ? <AdminActivity logs={activity} query={activityQuery} setQuery={setActivityQuery} onRefresh={openActivity} model={currentModel} onSave={saveModel}/> : <>
    <section className="shell">
      <div className="eyebrow"><Sparkles size={15}/> AI-assisted opportunity prioritization</div>
      <div className="heading-row"><div><h1>Route to Revenue</h1><p>Know exactly where to focus next.</p></div><div className="actions"><button className="btn secondary" onClick={() => setShowSettings(true)}><Settings2 size={16}/> Scoring model</button><button className="btn secondary" onClick={exportCsv}><ArrowDownToLine size={16}/> Export to Salesforce</button><button className="btn secondary" onClick={() => setShowDealWorkspace(true)}><Plus size={16}/> Add deal</button><button className="btn primary" onClick={() => setShowUpload(true)}><Upload size={16}/> Upload report</button></div></div>
      <section className="metrics"><div className="metric"><span>Active Pipeline</span><strong>{money.format(stats.pipeline)}</strong><small>{activeOpportunities.length} active opportunities</small></div><div className="metric"><span>Hot Opportunities</span><strong>{money.format(stats.hot)}</strong><small className="positive">{stats.hotCount} deals ready for focus</small></div><button className={`metric metric-button ${showGapsOnly?"selected":""}`} onClick={()=>setShowGapsOnly(current=>!current)}><span>Qualification Gaps <ChevronDown size={14}/></span><strong>{stats.flags}</strong><small className="warning-text">{showGapsOnly?"Showing opportunities with gaps · click to clear":"Click to drill down"}</small></button><div className="metric score-card"><span>Scoring Health</span><strong>{stats.health}%</strong><div className="progress"><i style={{width:`${stats.health}%`}} /></div><small>Share of scored deals with high confidence</small></div></section>
      <section className="impact-actions"><div className="impact-actions-head"><div><span className="eyebrow"><Sparkles size={14}/> Recommended Focus</span><h2>Five Most Impactful Next Steps</h2></div><p>Prioritized by deal value, qualification gaps, and opportunity score.</p></div><div className="impact-action-grid">{impactfulNextSteps.map(({opportunity,step},index)=><button key={opportunity.id} onClick={()=>{setQuery(opportunity.name);setActive(opportunity);setShowGapsOnly(false);}}><span>{index+1}</span><div><strong>{step}</strong><small>{opportunity.name} · {money.format(opportunity.amount)} · Score {opportunity.score}</small></div><ArrowUpRight size={16}/></button>)}</div></section>
      <section className="table-card"><div className="table-toolbar"><div className="table-title"><h2>Ranked Opportunities</h2><span>{filtered.length} shown · refreshed {new Date().toLocaleDateString()}</span></div><div className="toolbar-controls"><label className="filter-control search-control"><span>Search</span><div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Opportunities" /></div></label><label className="filter-control"><span>Stage</span><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option>All</option>{[...new Set(opportunities.map(o=>o.stage))].map(value=><option key={value}>{value}</option>)}</select></label><label className="filter-control"><span>Owner</span><select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option>All</option>{[...new Set(opportunities.map(o=>o.owner))].map(value=><option key={value}>{value}</option>)}</select></label><label className="filter-control"><span>Deal Size</span><select value={dealSizeFilter} onChange={e=>setDealSizeFilter(e.target.value)}><option>All</option><option>Small</option><option>Moderate</option><option>Big</option><option>Huge</option></select></label><label className="filter-control"><span>Lifecycle</span><select value={lifecycleFilter} onChange={e=>setLifecycleFilter(e.target.value)}><option value="All">All</option><option value="active">Active</option><option value="archived">Archived</option><option value="closed_won">Closed Won</option><option value="closed_lost">Closed Lost</option></select></label></div></div>
        {selected.length > 0 && <div className="bulk-bar"><strong>{selected.length} selected</strong><button className="btn secondary" onClick={rescoreSelected}>Re-score</button><button className="btn secondary" onClick={archiveSelected}>Archive</button><button className="btn secondary" onClick={()=>setSelected([])}>Clear</button></div>}
        <div className="tier-filter"><span className="tier-label">Priority Tier</span>{(["All", "Hot", "Work", "Nurture", "Deprioritize"] as const).map(item => <button key={item} className={tier === item ? "selected" : ""} onClick={() => setTier(item)}>{item === "All" ? "All Opportunities" : <><i className={`dot ${item.toLowerCase()}`} />{item}</>}</button>)}</div>
        <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select All Shown" checked={filtered.length>0&&filtered.every(o=>selected.includes(o.id))} onChange={e=>setSelected(e.target.checked?filtered.map(o=>o.id):[])}/></th><th><SortHeader column="name">Opportunity</SortHeader></th><th><SortHeader column="score">Score</SortHeader></th><th><SortHeader column="amount">Amount</SortHeader></th><th><SortHeader column="stage">Stage</SortHeader></th><th><SortHeader column="closeDate">Close Date</SortHeader></th><th><SortHeader column="source">Source</SortHeader></th><th><SortHeader column="nextStep">Next Step</SortHeader></th><th><SortHeader column="changed">Last Score</SortHeader></th><th /></tr></thead><tbody>{filtered.map(o => <Fragment key={o.id}><tr className={active?.id === o.id ? "expanded" : ""} onClick={() => setActive(current => current?.id === o.id ? null : o)}><td onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Select ${o.name}`} checked={selected.includes(o.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,o.id]:current.filter(id=>id!==o.id))}/></td><td><strong>{o.name}</strong><span>{o.account} · {o.owner}</span></td><td><div className="score-cell"><b className={`score ${o.tier.toLowerCase()}`}>{o.score}</b><span>{o.tier}</span></div></td><td><strong>{money.format(o.amount)}</strong><span>{o.forecast}</span></td><td><span className="stage">{o.stage}</span></td><td>{o.closeDate}</td><td>{o.source}</td><td className="next"><strong>{o.nextStep}</strong><span>{o.nextStepDate}</span></td><td><span className={o.changed >= 0 ? "change up" : "change down"}>{o.changed >= 0 ? "+" : ""}{o.changed} pts</span><span>{o.confidence} confidence</span></td><td><button className="row-menu" aria-label="More Actions"><MoreHorizontal size={17}/></button></td></tr>{active?.id === o.id && <OpportunityDrilldown opportunity={active} model={currentModel} onClose={() => setActive(null)} onRescore={rescoreOpportunity} />}</Fragment>)}</tbody></table></div>
      </section>
    </section>
    {showUpload && <div className="overlay"><section className="modal upload-modal"><button className="close" onClick={() => setShowUpload(false)}><X size={19}/></button><div className="modal-icon"><Upload size={23}/></div><h2>Upload Salesforce report</h2><p>Upload an Opportunity Report CSV. We&apos;ll detect the Salesforce fields, preserve existing opportunities, and score only records that changed.</p><button className="dropzone" onClick={() => input.current?.click()}><Upload size={22}/><strong>Choose a CSV report</strong><span>Salesforce Opportunity Report export · CSV only</span></button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/><div className="modal-note"><Bot size={15}/> AI analysis uses only approved mapped columns. You&apos;ll be able to review those columns before your first production import.</div></section></div>}
    {showDealWorkspace && <DealWorkspace model={currentModel} onClose={() => setShowDealWorkspace(false)} onSave={addManualDeal} />}
    {showSettings && <SettingsPanel model={currentModel} role={role} onClose={() => setShowSettings(false)} onSave={saveModel} />}</>}
  </main>;
}

function AdminActivity({ logs, query, setQuery, onRefresh, model, onSave }: { logs: ActivityLog[]; query: string; setQuery: (value:string)=>void; onRefresh: ()=>void; model:(string|number)[][]; onSave:(model:(string|number)[][])=>Promise<boolean> }) {
  const actionLabel=(log:ActivityLog)=>log.entity_type==="workspace_members"&&log.action==="insert"?"Account Created":log.entity_type==="session"&&log.action==="sign_in"?"Signed In":log.entity_type==="opportunities"&&log.action==="insert"?"Opportunity Created":log.entity_type==="opportunities"&&log.action==="update"?"Opportunity Updated":log.entity_type==="opportunities"&&log.action==="delete"?"Opportunity Deleted":log.action.replaceAll("_"," ");
  const areaLabel=(log:ActivityLog)=>log.entity_type==="workspace_members"?"User Account":log.entity_type==="session"?"Authentication":log.entity_type==="opportunities"?"Opportunity":log.entity_type.replaceAll("_"," ");
  const visible=logs.filter(log=>`${log.actor_email||"system"} ${actionLabel(log)} ${areaLabel(log)} ${log.entity_id||""}`.toLowerCase().includes(query.toLowerCase()));
  const describe=(log:ActivityLog)=>{ const detail=log.detail as {new?:Record<string,unknown>;old?:Record<string,unknown>}; const record=detail?.new||detail?.old||{}; const source=record.source_data as Record<string,unknown>|undefined; return String(source?.name||source?.account||record.salesforce_opportunity_id||log.entity_id||"—"); };
  return <section className="shell admin-activity"><div className="eyebrow"><Settings2 size={15}/> Administrator Only</div><div className="heading-row"><div><h1>Admin</h1><p>Manage the shared scoring model and review immutable workspace activity.</p></div><button className="btn secondary" onClick={onRefresh}>Refresh Activity</button></div><section className="admin-settings"><div className="section-title"><div><h2>Scoring Settings</h2><p>Add, delete, and allocate qualification categories. Expand each category for field expectations and scoring methodology.</p></div></div><ScoringModelEditor model={model} editable onSave={onSave}/></section><section className="metrics"><div className="metric"><span>Recorded Events</span><strong>{logs.length}</strong><small>Most recent 500 events</small></div><div className="metric"><span>Active Users</span><strong>{new Set(logs.map(log=>log.actor_email).filter(Boolean)).size}</strong><small>Authenticated actors in this log</small></div><div className="metric"><span>Score Events</span><strong>{logs.filter(log=>log.entity_type==="score_runs").length}</strong><small>Creates, edits, and re-scores</small></div></section><section className="table-card"><div className="table-toolbar"><div className="table-title"><h2>All Activity</h2><span>{visible.length} matching events</span></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search user, action, or record"/></label></div><div className="table-wrap"><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Area</th><th>Record</th></tr></thead><tbody>{visible.map(log=><tr key={log.id}><td><strong>{new Date(log.created_at).toLocaleDateString()}</strong><span>{new Date(log.created_at).toLocaleTimeString()}</span></td><td>{log.actor_email||"System"}</td><td><span className="stage">{actionLabel(log)}</span></td><td>{areaLabel(log)}</td><td>{describe(log)}</td></tr>)}</tbody></table></div></section></section>;
}

function OpportunityDrilldown({ opportunity, model, onClose, onRescore }: { opportunity: Opportunity; model:(string|number)[][]; onClose: () => void; onRescore: (opportunity: Opportunity, points: Record<string, number>, notes: string) => Promise<{ok:boolean;message:string}> }) {
  const [dealData, setDealData] = useState<DealData>(() => ({ ...opportunity.dealData, name: opportunity.name, account: opportunity.account, amount: String(opportunity.amount), closeDate: opportunity.closeDate, stage: opportunity.stage, forecast: opportunity.forecast, owner: opportunity.owner, source: opportunity.source, partner: opportunity.partner, nextStep: opportunity.nextStep, nextStepDate: opportunity.nextStepDate }));
  const [manualPoints, setManualPoints] = useState<Record<string, string>>(() => Object.fromEntries(model.map(([rawLabel]) => { const label=String(rawLabel); return [label, opportunity.dealData?.[`manualPoints:${label}`] || ""]; })));
  const [notes, setNotes] = useState(opportunity.dealData?.qualificationNotes || "");
  const [saveState,setSaveState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [saveMessage,setSaveMessage]=useState("");
  const analysisNames: Record<string, string> = {
    "Ideal Customer Fit": "Fit Analysis", "Pain And Urgency": "Pain Analysis", "Executive Sponsor": "Sponsor Analysis",
    "Budget And Funding Confidence": "Budget Analysis", "Timing / Compelling Event": "Timing Analysis", "Solution Fit": "Solution Analysis",
    "Value Proposition": "Value Analysis", "Engagement / Activity": "Activity Analysis", "Procurement Path": "Procurement Analysis",
    "Competitive Position": "Competitive Analysis", "Strategic Value": "Strategic Analysis", "Existing Relationships": "Relationship Analysis",
    "Resource Requirements": "Resource Analysis"
  };
  const fieldValue = (label: string) => dealData[`qualification:${label}`] || (label === "Engagement / Activity" ? `${opportunity.source} lead. Next step: ${opportunity.nextStep}.` : "");
  const editedOpportunity = () => { const account=dealData.account||opportunity.account; return ({ ...opportunity, name: formatOpportunityName(account,dealData.name||opportunity.name), account, amount: Number(dealData.amount)||0, closeDate: dealData.closeDate || opportunity.closeDate, stage: dealData.stage || opportunity.stage, forecast: dealData.forecast || opportunity.forecast, owner: dealData.owner || opportunity.owner, source: dealData.source || opportunity.source, partner: dealData.partner || opportunity.partner, nextStep: dealData.nextStep || opportunity.nextStep, nextStepDate: dealData.nextStepDate || opportunity.nextStepDate, dealData }); };
  const overrides = () => Object.fromEntries(model.flatMap(([rawLabel,rawMaximum])=>{const label=String(rawLabel);const maximum=Number(rawMaximum);const raw=manualPoints[label];return raw!==""?[[label,Math.min(maximum,Math.max(0,Math.round(Number(raw)||0)))]]:[];}));
  const saveAndRescore=async()=>{setSaveState("saving");setSaveMessage("Saving qualification changes and updating the score…");const result=await onRescore(editedOpportunity(),overrides(),notes);setSaveState(result.ok?"saved":"error");setSaveMessage(result.message);};
  return <tr className="drilldown-row"><td colSpan={10}><div className="drilldown">
    <div className="panel-head"><div><span className="eyebrow"><Bot size={14}/> AI score · {opportunity.confidence} confidence</span><h2>{opportunity.name}</h2><p>{opportunity.account} · {money.format(opportunity.amount)} · {opportunity.stage}</p></div><button className="drilldown-close" onClick={onClose}>Close <X size={17}/></button></div>
    <div className="panel-score"><div><span>Overall Score</span><strong>{opportunity.score}</strong><b className={`tier-badge ${opportunity.tier.toLowerCase()}`}>{opportunity.tier}</b></div><p>Review the qualification inputs below. Your updates become evidence for the next AI score run.</p></div>
    <details className="detail-editor"><summary>Sales Opportunity Detail · Click To Edit</summary><div className="deal-grid">{salesforceFields.map(([label,key,hint])=><label key={key}>{label}{hint&&<small>{hint}</small>}<input value={dealData[key]||""} onChange={e=>setDealData(current=>({...current,[key]:e.target.value}))}/></label>)}</div></details>
    {opportunity.flags?.length ? <div className="alert"><CircleAlert size={17}/><div><strong>Qualification gap</strong><span>{opportunity.flags.join(" · ")}</span></div></div> : null}
    <section className="deal-next-steps"><div><Sparkles size={16}/><h3>Suggested Next Steps</h3></div><ol>{suggestedNextSteps(opportunity,model).map(step=><li key={step}>{step}</li>)}</ol></section>
    <section className="explanation"><h3>Scoring Rationale</h3><p>{opportunity.analysis?.rationale || "The AI uses the imported deal context plus the qualification detail below."}</p><div className="evidence"><span>Evidence Used</span><b>Opportunity Description</b><b>Next Step</b><b>Partner Field</b></div></section>
    <section className="category-list"><div className="category-header"><div><h3>Full Category Detail</h3><p>Each category shows its maximum points, AI recommendation, and optional capped manual override.</p>{saveMessage&&<span className={`save-feedback ${saveState}`}>{saveMessage}</span>}</div><button className="btn primary rescore" disabled={saveState==="saving"} onClick={saveAndRescore}><Sparkles size={15}/> {saveState==="saving"?"Saving & Re-Scoring…":"Save Changes & Re-Score"}</button></div>
      {[...model].sort((a,b)=>Number(b[1])-Number(a[1])).map(([rawLabel, rawMaximum]) => { const label=String(rawLabel); const maximum=Number(rawMaximum); const recommended=opportunity.analysis?.categoryScores[label]?.points; const stored=Number(dealData[`aiPoints:${label}`]); const aiPoints=Math.min(maximum,Math.max(0,recommended ?? (Number.isFinite(stored)?stored:maximum*.2))); const manual=manualPoints[label]||""; const effective=manual===""?aiPoints:Math.min(maximum,Math.max(0,Math.round(Number(manual)||0))); const guidance=categoryGuidance[label]||{expected:`Enter customer-validated evidence relevant to ${label}.`,methodology:"Missing evidence earns 20% of available points. Stronger, specific, customer-validated evidence earns progressively more points."}; return <article className="category-detail-tile" key={label}><div className="category-tile-head"><div><strong>{label}</strong><span>Maximum {maximum} Points · Effective Score {effective} / {maximum}</span></div><div className="point-fields"><label>AI Recommended<input readOnly value={aiPoints}/></label><label>Manual Override<select value={manual} onChange={e=>setManualPoints(current=>({...current,[label]:e.target.value}))}><option value="">No Override</option>{Array.from({length:maximum+1},(_,value)=><option key={value} value={value}>{value} Points</option>)}</select></label></div></div><div className="category-tile-body"><details className="methodology"><summary>Field Expectations And Scoring Methodology</summary><p><b>Expected:</b> {guidance.expected}</p><p><b>Scoring:</b> {guidance.methodology}</p></details><label><b>Field Value:</b><textarea value={fieldValue(label)} placeholder={`Enter evidence for ${label.toLowerCase()}`} onChange={e=>setDealData(current=>({...current,[`qualification:${label}`]:e.target.value}))}/></label><p><b>{analysisNames[label] || "Category Analysis"}:</b> {opportunity.analysis?.categoryScores[label]?.rationale || `The AI recommends ${aiPoints} of ${maximum} available points based on the current evidence.`}</p></div></article>; })}
      <label className="qualification-notes">Qualification Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add what you learned about budget, buyer access, timing, competition, procurement, resources, or relationships…" /></label>
    </section>
    {opportunity.history?.length ? <section className="score-history"><h3>Score History</h3>{opportunity.history.slice(0,8).map(run=><div key={run.id}><strong>{Math.round(run.overall_score)} · {run.tier}</strong><span>{new Date(run.created_at).toLocaleString()} · {run.trigger} · model v{run.model_version||1}</span></div>)}</section>:null}
  </div></td></tr>;
}

function ScoringModelEditor({ model, editable, onSave, onSaved }: { model:(string|number)[][]; editable:boolean; onSave:(model:(string|number)[][])=>Promise<boolean>; onSaved?:()=>void }) {
  const [draft,setDraft]=useState<(string|number)[][]>(()=>[...model].sort((a,b)=>Number(b[1])-Number(a[1])).map(item=>[item[0],item[1]])); const [saving,setSaving]=useState(false); const [newName,setNewName]=useState("");
  const sorted=[...draft].sort((a,b)=>Number(b[1])-Number(a[1])); const total=draft.reduce((sum,item)=>sum+Number(item[1]),0);
  const updatePoints=(name:string,value:number)=>setDraft(current=>{const others=current.filter(item=>String(item[0])!==name).reduce((sum,item)=>sum+Number(item[1]),0);const capped=Math.min(Math.max(0,100-others),Math.max(0,Math.round(value)||0));return current.map(item=>String(item[0])===name?[item[0],capped]:item);});
  const addCategory=()=>{const name=newName.trim().replace(/\b\w/g,char=>char.toUpperCase());if(!name||draft.some(item=>String(item[0]).toLowerCase()===name.toLowerCase()))return;setDraft(current=>[...current,[name,0]]);setNewName("");};
  return <><div className="settings-list model-editor">{sorted.map(([name,points])=>{const label=String(name);const guidance=categoryGuidance[label]||{expected:`Enter customer-validated evidence relevant to ${label}.`,methodology:"Missing evidence earns 20% of available points. Stronger, specific, customer-validated evidence earns progressively more points."};return <details key={label} className="model-item"><summary><strong>{label}</strong><span><label><input type="number" min="0" max="100" value={String(points)} disabled={!editable} onClick={e=>e.stopPropagation()} onChange={e=>updatePoints(label,Number(e.target.value))}/> Points</label>{editable&&<button type="button" className="delete-category" onClick={e=>{e.preventDefault();setDraft(current=>current.filter(item=>String(item[0])!==label));}} aria-label={`Delete ${label}`}><X size={14}/></button>}<ChevronDown size={15}/></span></summary><div className="model-guidance"><p><b>Expected In This Field:</b> {guidance.expected}</p><p><b>Scoring Methodology:</b> {guidance.methodology}</p></div></details>;})}</div>{editable&&<div className="add-category"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New Category Name" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCategory();}}}/><button className="btn secondary" type="button" onClick={addCategory}><Plus size={15}/> Add Category</button></div>}<div className="settings-footer"><span className={total===100?"positive":"warning-text"}>Total {total} / 100 Points · {editable?"Admin Access":"Read-Only"}</span>{editable&&<button className="btn primary" disabled={total!==100||saving} onClick={async()=>{setSaving(true);const saved=await onSave(sorted);setSaving(false);if(saved)onSaved?.();}}>{saving?"Saving And Re-Scoring…":"Save And Re-Score"}</button>}</div></>;
}

function SettingsPanel({ model, role, onClose, onSave }: { model: (string|number)[][]; role: string; onClose: () => void; onSave: (model:(string|number)[][])=>Promise<boolean> }) {
  return <div className="overlay"><section className="modal settings-modal"><button className="close" onClick={onClose}><X size={19}/></button><div className="eyebrow"><Settings2 size={15}/> Shared Scoring Model</div><h2>Qualification Model</h2><p>Categories are sorted from highest to lowest maximum points. Expand any category to see what is expected and how it is scored.</p><ScoringModelEditor model={model} editable={role==="admin"} onSave={onSave} onSaved={onClose}/></section></div>;
}

function DealWorkspace({ model, onClose, onSave }: { model:(string|number)[][]; onClose: () => void; onSave: (deal: Omit<Opportunity, "score" | "tier" | "changed" | "confidence">) => void }) {
  const [data, setData] = useState<DealData>(() => ({ ...defaultDealData(), stage: "Qualification", forecast: "Pipeline", source: "Manual", probability: "10" }));
  const [manualPoints, setManualPoints] = useState<Record<string,string>>(()=>Object.fromEntries(model.map(([label])=>[String(label),""]))); const [analysis, setAnalysis] = useState<ScoreAnalysis | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"ready" | "scoring" | "error">("ready");
  const update = (key: string, value: string) => setData(current => ({ ...current, [key]: value }));
  const opportunityFromForm = (): Opportunity => {
    const amount = Number((data.amount || "").replace(/[^0-9.-]/g, "")) || 0;
    const score = Math.round(model.reduce((sum, [label, maximum]) => { const raw=manualPoints[String(label)]||""; const ai=analysis?.categoryScores[String(label)]?.points ?? Number(maximum)*.2; return sum+(raw===""?ai:Math.min(Number(maximum),Math.max(0,Math.round(Number(raw)||0)))); }, 0));
    const account=data.account||"Unassigned Customer";
    return { id: data.salesforceId || `manual-${Date.now()}`, name: formatOpportunityName(account,data.name||"Untitled Deal"), account, amount, closeDate: data.closeDate || "Not provided", stage: data.stage || "Qualification", forecast: data.forecast || "Pipeline", owner: data.owner || sampleOwners[0], source: data.source || "Manual", partner: data.partner || "—", nextStep: data.nextStep || "Validate qualification", nextStepDate: data.nextStepDate || "—", score, tier: tierFromScore(score), changed: 0, confidence: "Medium", dealData: data };
  };
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setStatus("scoring"); const opportunity = opportunityFromForm();
      try {
        const manualCategoryPoints = Object.fromEntries(model.flatMap(([label,maximum])=>{const raw=manualPoints[String(label)]||"";return raw!==""?[[String(label),Math.min(Number(maximum),Math.max(0,Math.round(Number(raw)||0)))]]:[];}));
        const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunity: { ...opportunity, salesforceFields: data, manualCategoryPoints, qualificationNotes: data.qualificationNotes || "" }, scoringModel: model }) });
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
    const aiPoints = Object.fromEntries(model.map(([label,maximum]) => [String(label), analysis?.categoryScores[String(label)]?.points ?? Number(maximum)*.2]));
    onSave({ ...opportunity, dealData: { ...data, qualificationNotes: data.qualificationNotes || "", ...Object.fromEntries(Object.entries(aiPoints).map(([key, value]) => [`aiPoints:${key}`, String(value)])), ...Object.fromEntries(Object.entries(manualPoints).filter(([,value])=>value!=="").map(([key,value])=>[`manualPoints:${key}`,value])) } });
  };
  const analysisFor = (label: string) => analysis?.categoryScores[label];
  const effectivePoints = (label: string, maximum: number) => {
    const recommended = analysisFor(label)?.points ?? maximum * 0.2;
    const manual = manualPoints[label];
    return manual === "" ? recommended : Math.min(maximum, Math.max(0, Math.round(Number(manual) || 0)));
  };
  const liveScore = Math.round(model.reduce((sum, [label, maximum]) => sum + effectivePoints(String(label), Number(maximum)), 0));
  return <section className="workspace"><div className="workspace-head"><div><div className="eyebrow"><Plus size={15}/> New Opportunity</div><h1>Add A Deal</h1><p>A dedicated working tab for Salesforce data, qualification evidence, and live analysis.</p></div><div className="workspace-actions"><span className={`workspace-status ${status}`}>{status === "scoring" ? "Updating analysis…" : status === "error" ? "Analysis will retry after your next update" : "Analysis up to date"}</span><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!data.name.trim() || !data.account.trim()} onClick={submit}>Add Scored Deal <ArrowUpRight size={16}/></button></div></div><div className="workspace-grid"><div className="workspace-form"><section className="form-card"><div className="section-title"><div><h2>Salesforce Deal Detail</h2><p>Enter the fields from the Opportunity record. Required fields are marked.</p></div></div><div className="deal-grid">{salesforceFields.map(([label, key, hint]) => <label key={key} className={key === "description" || key === "nextStep" ? "wide" : ""}>{label}{hint && <small>{hint}</small>}{key === "stage" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Prospecting", "Qualification", "Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(item => <option key={item}>{item}</option>)}</select> : key === "forecast" ? <select value={data[key]} onChange={e => update(key, e.target.value)}>{["Pipeline", "Best Case", "Commit", "Closed"].map(item => <option key={item}>{item}</option>)}</select> : key === "description" || key === "nextStep" ? <textarea value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "description" ? "Customer context, use case, scope, stakeholders…" : "What must happen next?"} /> : <input type={key === "closeDate" || key === "nextStepDate" ? "date" : key === "amount" || key === "probability" ? "number" : "text"} value={data[key]} onChange={e => update(key, e.target.value)} placeholder={key === "amount" ? "0" : ""} />}</label>)}</div></section><section className="form-card"><div className="section-title"><div><h2>Deal Qualification</h2><p>Every category starts collapsed. The title and score remain visible; open a group to update evidence and see its analysis.</p></div></div><div className="qualification-accordions">{[...model].sort((a,b)=>Number(b[1])-Number(a[1])).map(([rawLabel,rawMaximum])=>{const label=String(rawLabel);const key=`qualification:${label}`;const item=analysisFor(label);const isOpen=!!openCategories[label];const maximum=Number(rawMaximum);const recommended=item?.points??maximum*.2;const effective=effectivePoints(label,maximum);const guidance=categoryGuidance[label]||{expected:`Enter customer-validated evidence relevant to ${label}.`,methodology:"Missing evidence earns 20% of available points. Stronger, specific, customer-validated evidence earns progressively more points."};return <article className={`qualification-group ${isOpen?"open":""}`} key={key}><button type="button" className="qualification-summary" onClick={()=>setOpenCategories(current=>({...current,[label]:!current[label]}))}><span>{label}</span><b>{effective} / {maximum} Points</b><ChevronDown size={17}/></button>{isOpen&&<div className="qualification-content"><details className="methodology"><summary>Field Expectations And Scoring Methodology</summary><p><b>Expected:</b> {guidance.expected}</p><p><b>Scoring:</b> {guidance.methodology}</p></details><label>Seller-Entered Qualification Evidence<textarea value={data[key]||""} onChange={e=>update(key,e.target.value)} placeholder={`Evidence for ${label.toLowerCase()}…`}/></label><div className="point-fields"><label>AI Recommended<input readOnly value={recommended}/></label><label>Manual Override<select value={manualPoints[label]||""} onChange={e=>setManualPoints(current=>({...current,[label]:e.target.value}))}><option value="">No Override</option>{Array.from({length:maximum+1},(_,value)=><option key={value} value={value}>{value} Points</option>)}</select></label></div><div className="category-analysis"><strong>Resulting Analysis</strong><p>{item?.rationale||"Analysis will appear here after your update is scored."}</p>{item?.evidence?.length?<p><b>Evidence Used:</b> {item.evidence.join(" · ")}</p>:null}{item?.missingInformation?.length?<small>Still Needed: {item.missingInformation.join(" · ")}</small>:null}</div></div>}</article>;})}<label className="qualification-notes">Additional Qualification Notes<textarea value={data.qualificationNotes || ""} onChange={e => update("qualificationNotes", e.target.value)} placeholder="Budget, executive sponsor, timing, competition, procurement, relationships, or any other context…" /></label></div></section></div><aside className="analysis-card"><div className="analysis-score"><span>Live Opportunity Score</span><strong>{liveScore}</strong><b>{tierFromScore(liveScore)}</b></div><h2>Qualification Analysis</h2><p className="analysis-intro">{analysis?.rationale || "Add deal information and evidence. Analysis updates automatically when you pause after a change."}</p><p className="analysis-hint">Open a category to view the data entered and its resulting analysis.</p></aside></div></section>;
}
