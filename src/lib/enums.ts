// Enum-like constants — Prisma uses String fields because SQLite doesn't
// support native enums. Validate at app boundaries with these unions.

export const ROLES = ["OWNER", "DIRECTOR", "OBSERVER", "ADMIN", "GUEST"] as const;
export type Role = (typeof ROLES)[number];

export const MEETING_STATUSES = ["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_TYPES = ["REGULAR", "SPECIAL", "ANNUAL", "COMMITTEE"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const ATTENDANCE_STATUSES = [
  "INVITED",
  "ACCEPTED",
  "DECLINED",
  "TENTATIVE",
  "ATTENDED",
  "ABSENT",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const RESOLUTION_STATUSES = ["DRAFT", "OPEN", "PASSED", "FAILED", "WITHDRAWN"] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

export const RESOLUTION_KINDS = ["MEETING_VOTE", "WRITTEN_CONSENT"] as const;
export type ResolutionKind = (typeof RESOLUTION_KINDS)[number];

export const VOTE_CHOICES = ["FOR", "AGAINST", "ABSTAIN"] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

export const DOCUMENT_VISIBILITIES = ["ALL_MEMBERS", "DIRECTORS_ONLY", "PRIVATE"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export const ACTION_ITEM_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

// Report sections
export const REPORT_SECTION_KINDS = ["text", "rich", "metric", "checklist"] as const;
export type ReportSectionKind = (typeof REPORT_SECTION_KINDS)[number];

export const REPORT_STATUSES = ["DRAFT", "PUBLISHED"] as const;

// Financial scenarios
export const SCENARIO_KINDS = ["BASE", "UPSIDE", "DOWNSIDE", "CUSTOM"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

// Risk register
export const RISK_CATEGORIES = ["STRATEGIC", "FINANCIAL", "OPERATIONAL", "PEOPLE", "TECHNICAL", "LEGAL", "MARKET"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export const RISK_CATEGORY_LABELS: Record<string, string> = {
  STRATEGIC: "Strategic",
  FINANCIAL: "Financial",
  OPERATIONAL: "Operational",
  PEOPLE: "People",
  TECHNICAL: "Technical",
  LEGAL: "Legal & compliance",
  MARKET: "Market",
};

export const RISK_STATUSES = ["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export const RISK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  MITIGATING: "Mitigating",
  ACCEPTED: "Accepted",
  CLOSED: "Closed",
};

// Projects / initiatives
export const PROJECT_STATUSES = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "PAUSED", "COMPLETED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

export const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE", "SLIPPED"] as const;
export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  SLIPPED: "Slipped",
};

// Customers
export const CUSTOMER_STATUSES = ["PROSPECT", "PILOT", "ACTIVE", "AT_RISK", "CHURNED"] as const;
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  PILOT: "Pilot",
  ACTIVE: "Active",
  AT_RISK: "At risk",
  CHURNED: "Churned",
};

export const CUSTOMER_HEALTHS = ["GREEN", "AMBER", "RED"] as const;
export const CUSTOMER_HEALTH_LABELS: Record<string, string> = {
  GREEN: "Healthy",
  AMBER: "Watch",
  RED: "At risk",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  DIRECTOR: "Director",
  OBSERVER: "Observer",
  ADMIN: "Admin",
  GUEST: "Guest",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const RESOLUTION_STATUS_LABELS: Record<ResolutionStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open for voting",
  PASSED: "Passed",
  FAILED: "Failed",
  WITHDRAWN: "Withdrawn",
};
