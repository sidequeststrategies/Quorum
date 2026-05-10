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

// Coaching
export const COACHING_PROGRAM_KINDS = ["FOUNDER", "EXEC", "MANAGER", "TEAM"] as const;
export const COACHING_PROGRAM_LABELS: Record<string, string> = {
  FOUNDER: "Founder coaching",
  EXEC: "Executive coaching",
  MANAGER: "Manager coaching",
  TEAM: "Team coaching",
};

export const COACHING_CLIENT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;
export const LESSON_ASSIGNMENT_STATUSES = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "SKIPPED"] as const;

// Retreats
export const RETREAT_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const ACTIVITY_KINDS = ["ICEBREAKER", "TRUST", "STRATEGIC", "TEAM_SKILL", "LEADERSHIP", "REFLECTION"] as const;
export const ACTIVITY_KIND_LABELS: Record<string, string> = {
  ICEBREAKER: "Icebreaker",
  TRUST: "Trust building",
  STRATEGIC: "Strategic alignment",
  TEAM_SKILL: "Team skill",
  LEADERSHIP: "Leadership",
  REFLECTION: "Reflection",
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
