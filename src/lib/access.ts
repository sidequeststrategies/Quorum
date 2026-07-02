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

export function ssoEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
