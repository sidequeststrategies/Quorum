// SSO access gate, shared by Supabase Auth and the NextAuth Google provider.
// Only emails on the allowlist (or in an allowed domain) may create an
// account via SSO. Comma-separated env vars:
//   GOOGLE_ALLOWED_EMAILS="danny@sidequeststrategies.com,ceo@assetcool.com"
//   GOOGLE_ALLOWED_DOMAINS="assetcool.com"
// Users who already exist in the app (e.g. invited members) are always
// allowed to sign in regardless of the allowlist.

const ALLOWED_EMAILS = (process.env.GOOGLE_ALLOWED_EMAILS ?? "danny@sidequeststrategies.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_DOMAINS = (process.env.GOOGLE_ALLOWED_DOMAINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Page-scoped guests: emails here may sign in with Google but only ever see
// /pipelinereport — every other page bounces them back there, and they can't
// create an organization. For sharing the pipeline report with e.g. an
// investor without granting portal access.
//   PIPELINE_REPORT_GUEST_EMAILS="investor@fund.com"
const GUEST_EMAILS = (process.env.PIPELINE_REPORT_GUEST_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function pipelineReportGuest(email: string | null | undefined): boolean {
  return !!email && GUEST_EMAILS.includes(email.toLowerCase());
}

export function ssoEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  if (GUEST_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
