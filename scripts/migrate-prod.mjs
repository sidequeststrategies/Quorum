// One-command production migration:
//   node scripts/migrate-prod.mjs
//
// Gets the production DATABASE_URL from (in order): the DATABASE_URL env var
// if already set; a Vercel env pull (skipped for Sensitive vars, which pull
// as empty); otherwise an interactive paste prompt. The value is never
// printed and never left on disk — the pulled env file is deleted even on
// failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env.vercel-prod");

const isPgUrl = (u) => /^postgres(ql)?:\/\//.test(u ?? "");

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true, // resolves vercel.cmd / npm.cmd on Windows
    env: { ...process.env, ...extraEnv },
  });
  return r.status ?? 1;
}

function fromVercelPull() {
  console.log("Trying a Vercel env pull…");
  const pull = run("npx", ["--yes", "vercel", "env", "pull", ".env.vercel-prod", "--environment=production"]);
  if (pull !== 0) return null;
  const line = fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  let url = line ? line.slice("DATABASE_URL=".length).trim() : "";
  if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);
  return isPgUrl(url) ? url : null;
}

function fromPrompt() {
  console.log("\nDATABASE_URL is a Sensitive var in Vercel, so it can't be pulled.");
  console.log("Get it from Supabase: your project → Connect (top bar) → Connection string");
  console.log("→ Transaction pooler → copy the URI and replace [YOUR-PASSWORD] with the DB password.");
  console.log("(It looks like postgres://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres)\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Paste the connection string and press Enter: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

try {
  let url = process.env.DATABASE_URL;
  if (!isPgUrl(url)) url = fromVercelPull();
  if (!isPgUrl(url)) url = await fromPrompt();
  if (!isPgUrl(url)) {
    console.error("That doesn't look like a Postgres URL (postgres://…) — aborting.");
    process.exit(1);
  }
  if (url.includes("[YOUR-PASSWORD]")) {
    console.error("The string still contains the [YOUR-PASSWORD] placeholder — swap in the real database password and re-run.");
    process.exit(1);
  }

  console.log("\nApplying migrations to production…");
  const mig = run("npm", ["run", "db:push"], { DATABASE_URL: url });
  if (mig !== 0) process.exit(mig);

  console.log("Done — production schema is up to date.");
} finally {
  fs.rmSync(envFile, { force: true });
}
