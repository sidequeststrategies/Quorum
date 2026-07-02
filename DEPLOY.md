# Deploying Quorum to quorum.sidequeststrategies.com

> **STACK UPDATE (July 2026):** the app now runs on **Postgres** — Supabase in
> production, embedded PGlite locally — and supports **Supabase Auth** for
> Google SSO. The Turso/libSQL instructions in steps 2–4 below are superseded;
> see the [AssetCool deployment](#assetcool-deployment-boardreporting) section
> for the current runbook. Local dev needs no database service at all:
> `npm run db:push && npm run db:seed && npm run dev` uses PGlite under
> `data/pglite/` with the NextAuth password demo logins.

Target stack: **Vercel** (Next.js host) + **Turso** (libSQL database) + **Vercel Blob** (file storage). All three have free tiers that comfortably cover this scale; estimated cost at low usage: **$0/month**.

End-to-end time: 30–45 minutes. Most of it is waiting for DNS to propagate and Vercel to provision SSL.

---

## Pre-flight checklist

You'll need accounts on:

- [ ] **GitHub** — to host the repo (Vercel deploys from a git remote)
- [ ] **Vercel** — `https://vercel.com/signup` (sign up with GitHub for one-click setup)
- [ ] **Turso** — `https://turso.tech` (free tier: 9GB total, 1B row reads/month)
- [ ] Access to **DNS for sidequeststrategies.com** — wherever it's registered (GoDaddy, Cloudflare, Namecheap, etc.)
- [ ] (Optional) **Anthropic API key** for the `/chat` AI assistant — `https://console.anthropic.com/`

---

## Step 1 — Push to GitHub

```bash
cd C:\Users\nydel\Claude\Quorum
git init
git add -A
git commit -m "Initial commit"
gh repo create quorum --private --source=. --remote=origin --push
```

(Or create the repo manually at github.com and `git push -u origin main`.)

The `.gitignore` already excludes `node_modules/`, `.next/`, `data/*.db`, `.env`, and `public/uploads/`.

---

## Step 2 — Provision Turso database

```bash
# Install Turso CLI (one-time)
# Windows (PowerShell, requires WSL): see https://docs.turso.tech/cli/installation
# Or use the web UI at https://app.turso.tech

# Create the database
turso db create quorum-prod

# Get the URL — looks like: libsql://quorum-prod-yourorg.turso.io
turso db show --url quorum-prod

# Create an auth token (copy it — shown only once)
turso db tokens create quorum-prod
```

Save both the URL and token. You'll paste them into Vercel in step 4.

---

## Step 3 — Apply the schema to Turso

From your local machine, run the migration script against the Turso DB:

```bash
DATABASE_URL="libsql://quorum-prod-yourorg.turso.io" \
DATABASE_AUTH_TOKEN="your-token-here" \
npm run db:push
```

This applies every file under `drizzle/` in order. Idempotent — safe to re-run.

**Do not run `npm run db:seed` against production.** The seed wipes demo data and recreates it; the seed script now refuses to run if `DATABASE_URL` looks like a production database (set `ALLOW_PROD_SEED=1` only if you want to populate the demo accounts on prod for testing — typically you don't).

---

## Step 4 — Deploy to Vercel

### 4a. Connect the repo

1. Go to `https://vercel.com/new`
2. Import the `quorum` repo from GitHub
3. Vercel auto-detects Next.js — leave the framework preset as **Next.js**
4. **Don't deploy yet** — click "Environment Variables" first

### 4b. Set environment variables

Paste these into Vercel's "Environment Variables" section. Mark anything that looks secret as **Sensitive**.

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `libsql://quorum-prod-yourorg.turso.io` | From step 2 |
| `DATABASE_AUTH_TOKEN` | `eyJhbGciOiJ...` | From step 2 — **Sensitive** |
| `AUTH_SECRET` | (32 random bytes, base64) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **Sensitive** |
| `AUTH_TRUST_HOST` | `true` | |
| `NEXTAUTH_URL` | `https://quorum.sidequeststrategies.com` | Must match your final domain |
| `STORAGE_DRIVER` | `vercel-blob` | |
| `ANTHROPIC_API_KEY` | (your key, optional) | Leave unset to disable `/chat` — **Sensitive** |

### 4c. Connect a Vercel Blob store

1. In your Vercel project, go to **Storage → Connect Store**
2. Pick **Blob → Create**
3. Name it `quorum-uploads`
4. Vercel auto-injects `BLOB_READ_WRITE_TOKEN` into your project — no manual env var needed

### 4d. Deploy

Click **Deploy**. First build takes ~2–3 minutes. Vercel gives you a URL like `quorum-abc123.vercel.app` — verify it loads:

- `https://your-vercel-url.vercel.app/` — landing page
- `https://your-vercel-url.vercel.app/signup` — create your real owner account

---

## Step 5 — Custom domain

### 5a. Add the domain in Vercel

1. Project → **Settings → Domains**
2. Add `quorum.sidequeststrategies.com`
3. Vercel will tell you to add a DNS record. It'll look like one of:
   - **CNAME**: `quorum` → `cname.vercel-dns.com`  *(typical)*
   - **A**: `quorum` → `76.76.21.21` *(if your registrar disallows CNAME on root, but this is a subdomain so CNAME works)*

### 5b. Add the DNS record at your registrar

Wherever `sidequeststrategies.com` is registered:

| Type | Name | Value | TTL |
|---|---|---|---|
| `CNAME` | `quorum` | `cname.vercel-dns.com` | 300 (or auto) |

DNS usually propagates within 5–15 minutes. Vercel auto-provisions an SSL cert via Let's Encrypt the moment it can verify the record.

### 5c. Verify

- Wait until Vercel's domain panel shows "Valid Configuration" with a green checkmark
- Visit `https://quorum.sidequeststrategies.com` — should serve the Quorum landing page over HTTPS

---

## Step 6 — Create your real owner account

1. Visit `https://quorum.sidequeststrategies.com/signup`
2. Fill in your name, email, password, and company name
3. You're now the OWNER of your real workspace; the password hash goes into the Turso DB

Tell other directors / advisors / coaching clients to use the same `/signup` page (or invite them via the **Members → Invite** flow inside the app once you're logged in).

---

## Local development continues to work unchanged

After the deploy, you can keep running locally with `npm run dev`. The dev environment uses:

- `node:sqlite` against `data/quorum.db` (file-backed, fast, no external services)
- Local disk under `public/uploads/` for files
- The seed-based demo accounts (`riley@acme.demo` etc.)

Production uses Turso + Vercel Blob, but neither side knows or cares about the other — the abstractions in `src/lib/db.ts` and `src/lib/storage.ts` switch based on `DATABASE_URL` and `STORAGE_DRIVER` env vars at startup.

---

## Common issues

**"missing required error components" when visiting localhost:3000.** Stale `wslrelay.exe` from a prior WSL session is squatting on `[::1]:3000`. Kill it: `Get-Process wslrelay -ErrorAction SilentlyContinue | Stop-Process -Force` in PowerShell, or `wsl --shutdown`. See `~/.claude/.../memory/feedback_wslrelay_port_steal.md`.

**Build fails on Vercel with "Cannot find module 'node:sqlite'".** Should not happen now — the webpack config in `next.config.mjs` externalizes it, and the runtime adapter uses libsql/HTTP not node:sqlite when `DATABASE_URL` starts with `libsql://`. If it does happen, check the Vercel build log for the exact stage that fails.

**Auth.js redirects fail on production with the wrong host.** `NEXTAUTH_URL` must be set to the *final* `https://quorum.sidequeststrategies.com` URL, not the `vercel.app` preview URL. Also ensure `AUTH_TRUST_HOST=true`.

**Files uploaded before adding Vercel Blob 404 in production.** Local-driver URLs (`/uploads/...`) only work when files exist on the local disk — they don't on Vercel's ephemeral filesystem. Anything uploaded before switching to vercel-blob is gone. Re-upload via the UI.

**Reset Turso to clean slate.** `turso db destroy quorum-prod` then re-create and re-run `npm run db:push`. Be sure — this is irreversible.

---

## AssetCool deployment (/boardreporting)

The board-reporting portal lives at `https://assetcool.sidequeststrategies.com/boardreporting`, proxied by the `assetcool-retreat` Vercel project (which owns the `assetcool` subdomain). It runs against the **existing todo-project Supabase project** — its Postgres for data (in a dedicated `board` schema, so todo tables are untouched) and its already-configured **Google SSO** via Supabase Auth. No Google Console changes are needed.

### 1. Prepare Supabase (~5 minutes, in the todo project's dashboard)

1. **Connection string** — Project Settings → Database → Connection string → **Transaction** mode (port 6543). This becomes `DATABASE_URL`.
2. **API keys** — Project Settings → API: copy the Project URL and `anon` key.
3. **Auth redirect** — Authentication → URL Configuration → Redirect URLs, add:
   - `https://assetcool.sidequeststrategies.com/boardreporting/auth/callback`
   - `https://<your-project>.vercel.app/boardreporting/auth/callback` (for testing before DNS)
4. Google is already enabled as a provider for the todo app — nothing else to do.

The `board` schema is **not** exposed through Supabase's REST API (only schemas explicitly listed under API settings are served), so the data is reachable only via the app's server-side connection.

### 2. Apply the schema

From your machine, with the connection string from step 1:

```bash
DATABASE_URL="postgres://...pooler.supabase.com:6543/postgres" npm run db:push
```

Creates the `board` schema and all tables. Idempotent — safe to re-run. **Do not run `npm run db:seed` against Supabase** (demo data belongs on local/demo instances; the seed refuses production URLs unless `ALLOW_PROD_SEED=1`).

### 3. Vercel project

Create a Vercel project from this repo (e.g. `quorum-boardreporting`) with env vars:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase pooler connection string | **Sensitive** |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Enables Supabase Auth mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Safe to expose; used only for auth |
| `NEXT_PUBLIC_BASE_PATH` | `/boardreporting` | Serves every route under the prefix |
| `GOOGLE_ALLOWED_EMAILS` | `danny@sidequeststrategies.com` | Comma-separated allowlist for first-time SSO sign-ins |
| `GOOGLE_ALLOWED_DOMAINS` | (optional) `assetcool.com` | Allow a whole domain |
| `AUTH_SECRET` | 32 random bytes, base64 | Still required (NextAuth fallback code path) — **Sensitive** |
| `STORAGE_DRIVER` | `vercel-blob` | Plus connect a Blob store (Storage → Connect) |
| `ANTHROPIC_API_KEY` | (optional) | Enables the `/chat` assistant — **Sensitive** |

Then, in the `assetcool-retreat` repo, point the `rewrites` in `vercel.json` at this project's `*.vercel.app` production domain and redeploy it.

### How sign-in works

- With Supabase configured, the login page shows **Continue with Google**, which round-trips through the todo project's existing Google provider. First-time sign-ins are gated by `GOOGLE_ALLOWED_EMAILS`/`GOOGLE_ALLOWED_DOMAINS`; anyone not on the list is signed out with a friendly error. Users who already exist in the app (e.g. invited members) always get through.
- Password signup is disabled in SSO mode — accounts are provisioned automatically on first allowed Google sign-in.
- Locally (no Supabase env vars) the app falls back to the NextAuth password login with the seeded demo accounts.

## Operational notes

- **Database backups.** Turso supports point-in-time restore on its paid tier. On the free tier, run `turso db shell quorum-prod ".dump" > backup.sql` periodically and store the dump somewhere safe.
- **Schema changes.** Edit `src/db/schema.ts`, then `npm run db:generate` to emit a new migration file under `drizzle/`, then either run `npm run db:push` locally against Turso to apply, or commit and let your next Vercel deploy run a `prebuild` migration step (you can add `"prebuild": "npm run db:push"` to `package.json` scripts if you want auto-migrations on deploy — but be aware that destructive changes will run automatically).
- **Anthropic API key rotation.** Rotate at `console.anthropic.com`, paste the new value into Vercel env vars, redeploy.
- **Rolling back a bad deploy.** Vercel keeps every previous deployment; in the Deployments tab, find the last good one and click **Promote to Production**.
