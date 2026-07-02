// Built-in, best-practice board report templates — pure definitions with no
// db import so the seed script can consume them too. Provisioning lives in
// lib/report-templates.ts (ensureGlobalTemplates).

export type TemplateSection = {
  id: string;
  title: string;
  kind: "text" | "rich" | "metric" | "checklist";
  prompt?: string;
};

export const MONTHLY_BOARD_REPORT: { name: string; description: string; sections: TemplateSection[] } = {
  name: "Monthly Board Report",
  description:
    "The tight monthly update: numbers first, then narrative, then asks. Designed to be written in under an hour and read in ten minutes.",
  sections: [
    {
      id: "tldr",
      title: "TL;DR",
      kind: "rich",
      prompt:
        "3–4 sentences: the state of the business this month, the single most important thing the board should know, and what you need from them. Write this last.",
    },
    {
      id: "metrics",
      title: "Key metrics",
      kind: "metric",
      prompt: "Auto-filled from the latest financial snapshot — adjust or annotate as needed.",
    },
    {
      id: "financials",
      title: "Financial summary",
      kind: "rich",
      prompt:
        "Cash position and runway, revenue vs plan, notable variances and one-time items. Lead with the number, then the explanation.",
    },
    {
      id: "highlights",
      title: "Highlights",
      kind: "rich",
      prompt: "3–5 wins with names and numbers (deals closed, milestones shipped, key hires). Bullets, not prose.",
    },
    {
      id: "lowlights",
      title: "Lowlights & challenges",
      kind: "rich",
      prompt:
        "What went worse than planned, and what you're doing about it. Boards trust reports with real lowlights — vague concerns help no one.",
    },
    {
      id: "projects",
      title: "Key projects & milestones",
      kind: "rich",
      prompt: "One line per initiative: status (on/at-risk/off track), what moved this month, next milestone.",
    },
    {
      id: "customers",
      title: "Customers & pipeline",
      kind: "rich",
      prompt: "Key-account health changes, notable wins/losses, pipeline movement, churn signals.",
    },
    {
      id: "team",
      title: "Team",
      kind: "rich",
      prompt: "Hires, departures, open roles, and anything on morale or key-person load.",
    },
    {
      id: "asks",
      title: "Asks of the board",
      kind: "rich",
      prompt: "Specific and actionable: intros (name the firms), advice on a decision, approvals needed. Number them.",
    },
  ],
};

export const QUARTERLY_BOARD_REPORT: { name: string; description: string; sections: TemplateSection[] } = {
  name: "Quarterly Board Report",
  description:
    "The formal quarterly pack narrative: strategy scorecard, deep financials, forecast changes, risk review, and proposed resolutions.",
  sections: [
    {
      id: "ceo_letter",
      title: "CEO letter",
      kind: "rich",
      prompt:
        "One page, written like a letter: how the quarter went, what you believe now that you didn't three months ago, and where the company is going next quarter.",
    },
    {
      id: "metrics",
      title: "KPI dashboard",
      kind: "metric",
      prompt: "Auto-filled from the latest snapshot. Add QoQ and YoY comparisons plus any north-star metrics.",
    },
    {
      id: "financials",
      title: "Financial review",
      kind: "rich",
      prompt:
        "Revenue/ARR vs plan with variance explanations, gross margin trend, burn and runway, balance-sheet notes (AR/AP), and unit economics if they moved.",
    },
    {
      id: "forecast",
      title: "Forecast & outlook",
      kind: "rich",
      prompt:
        "What changed in the forward view since last quarter and why: growth assumptions, hiring plan, runway. Reference the captured forecast comparison in the board pack.",
    },
    {
      id: "strategy",
      title: "Strategic priorities scorecard",
      kind: "rich",
      prompt:
        "The 3–5 annual priorities, each with a status and one sentence of evidence. This is the section boards read second (after the TL;DR).",
    },
    {
      id: "product",
      title: "Product & roadmap",
      kind: "rich",
      prompt: "What shipped, adoption/feedback signals, what's next quarter, and any roadmap changes with rationale.",
    },
    {
      id: "gtm",
      title: "Go-to-market & sales",
      kind: "rich",
      prompt:
        "Pipeline coverage, win/loss themes, motion changes, pricing learnings, quota attainment and sales capacity plan.",
    },
    {
      id: "customers",
      title: "Customers & market",
      kind: "rich",
      prompt: "Key-account movements, NRR/churn story, competitive and market shifts worth the board's attention.",
    },
    {
      id: "team",
      title: "Team & organization",
      kind: "rich",
      prompt: "Org changes, exec hires/gaps, headcount plan vs actual, culture/engagement signals.",
    },
    {
      id: "risks",
      title: "Risk register review",
      kind: "rich",
      prompt:
        "Changes to the register since last quarter: new risks, severity moves, closed items. Reference the live register in the board pack.",
    },
    {
      id: "governance",
      title: "Governance & compliance",
      kind: "rich",
      prompt: "Cap table changes, option grants for approval, legal/regulatory items, audit and compliance status.",
    },
    {
      id: "asks",
      title: "Asks & proposed resolutions",
      kind: "rich",
      prompt: "Numbered asks, plus the resolutions you want voted this meeting (draft them under Decisions & votes).",
    },
  ],
};

export const BUILTIN_TEMPLATES = [MONTHLY_BOARD_REPORT, QUARTERLY_BOARD_REPORT];

