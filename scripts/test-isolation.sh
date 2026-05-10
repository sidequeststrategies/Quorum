#!/usr/bin/env bash
# End-to-end isolation tests for Quorum's multi-tenancy model.
#
# Boots a transient curl session for each demo user, fetches every list page,
# and asserts that:
#   1) Founders only see content from THEIR own org.
#   2) Foreign-org names/data never leak into a founder's view.
#   3) Danny (cross-portfolio) sees all 3 orgs in the portfolio + can switch.
#
# Run while `npm run dev` is up on http://localhost:3000.

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
COOKIES_DIR="$(mktemp -d)"
trap 'rm -rf "$COOKIES_DIR"' EXIT

PASS=0
FAIL=0
FAIL_LINES=()

red() { printf "\033[31m%s\033[0m" "$1"; }
green() { printf "\033[32m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

check() {
  local label="$1"
  local outcome="$2"
  if [[ "$outcome" == "ok" ]]; then
    PASS=$((PASS+1))
    printf "  $(green '✓') %s\n" "$label"
  else
    FAIL=$((FAIL+1))
    FAIL_LINES+=("$label")
    printf "  $(red '✗') %s\n" "$label"
  fi
}

login() {
  local email="$1"
  local cookies_file="$COOKIES_DIR/$email.txt"
  local csrf
  csrf=$(curl -s -c "$cookies_file" "$BASE/api/auth/csrf" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
  local code
  code=$(curl -s -b "$cookies_file" -c "$cookies_file" \
    -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=$csrf&email=$email&password=password123&redirect=false&json=true" \
    -o /dev/null -w "%{http_code}")
  if [[ "$code" != "302" && "$code" != "200" ]]; then
    echo "  $(red 'login failed') ($email): http $code"
    return 1
  fi
  echo "$cookies_file"
}

fetch() {
  local cookies_file="$1"
  local path="$2"
  local out_file="$3"
  curl -s -b "$cookies_file" -L -o "$out_file" -w "%{http_code}" "$BASE$path"
}

contains() { grep -qF "$2" "$1"; }
not_contains() { ! grep -qF "$2" "$1"; }

# ────────────────────────────────────────────────────────────────────────
# 1. RILEY (Acme CEO) — must only see Acme
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '── riley@acme.demo (Acme CEO) ──')"
RILEY=$(login "riley@acme.demo")
TMP=$(mktemp)

fetch "$RILEY" /dashboard "$TMP" >/dev/null
contains "$TMP" "Acme Robotics" && check "Riley dashboard shows Acme" ok || check "Riley dashboard shows Acme" fail
not_contains "$TMP" "Northstar Grid" && check "Riley dashboard does NOT leak Northstar" ok || check "Riley dashboard does NOT leak Northstar" fail
not_contains "$TMP" "Harbor Logics" && check "Riley dashboard does NOT leak Harbor" ok || check "Riley dashboard does NOT leak Harbor" fail

fetch "$RILEY" /meetings "$TMP" >/dev/null
contains "$TMP" "Acme Q" && check "Riley meetings shows Acme meetings" ok || check "Riley meetings shows Acme meetings" fail
not_contains "$TMP" "Northstar — Seed" && check "Riley meetings does NOT leak Northstar meetings" ok || check "Riley meetings does NOT leak Northstar meetings" fail
not_contains "$TMP" "Harbor — Series B" && check "Riley meetings does NOT leak Harbor meetings" ok || check "Riley meetings does NOT leak Harbor meetings" fail

fetch "$RILEY" /resolutions "$TMP" >/dev/null
contains "$TMP" "operating budget" && check "Riley resolutions shows Acme budget vote" ok || check "Riley resolutions shows Acme budget vote" fail
not_contains "$TMP" "German market expansion" && check "Riley resolutions does NOT leak Harbor's Germany resolution" ok || check "Riley resolutions does NOT leak Harbor's Germany resolution" fail
not_contains "$TMP" "seed financing" && check "Riley resolutions does NOT leak Northstar's seed resolution" ok || check "Riley resolutions does NOT leak Northstar's seed resolution" fail

fetch "$RILEY" /financials "$TMP" >/dev/null
contains "$TMP" "FY2026 Operating Plan" && check "Riley financials shows Acme plan" ok || check "Riley financials shows Acme plan" fail
not_contains "$TMP" "Seed-to-Series-A Plan" && check "Riley financials does NOT leak Northstar plan" ok || check "Riley financials does NOT leak Northstar plan" fail
not_contains "$TMP" "Germany Expansion" && check "Riley financials does NOT leak Harbor plan" ok || check "Riley financials does NOT leak Harbor plan" fail

fetch "$RILEY" /members "$TMP" >/dev/null
contains "$TMP" "Riley Chen" && check "Riley members shows Riley" ok || check "Riley members shows Riley" fail
not_contains "$TMP" "Maya Okonkwo" && check "Riley members does NOT leak Maya (Northstar founder)" ok || check "Riley members does NOT leak Maya" fail
not_contains "$TMP" "Liam Ó Briain" && check "Riley members does NOT leak Liam (Harbor founder)" ok || check "Riley members does NOT leak Liam" fail

fetch "$RILEY" /coaching "$TMP" >/dev/null
not_contains "$TMP" "First-Time Founder Fundamentals" && check "Riley coaching does NOT leak Danny's programs" ok || check "Riley coaching does NOT leak Danny's programs" fail
not_contains "$TMP" "Series A → Series B Operator" && check "Riley coaching does NOT leak Danny's exec program" ok || check "Riley coaching does NOT leak Danny's exec program" fail

fetch "$RILEY" /coaching/clients "$TMP" >/dev/null
not_contains "$TMP" "Maya Okonkwo" && check "Riley clients does NOT leak Danny's coaching client (Maya)" ok || check "Riley clients does NOT leak Danny's coaching client (Maya)" fail
not_contains "$TMP" "Liam Ó Briain" && check "Riley clients does NOT leak Danny's coaching client (Liam)" ok || check "Riley clients does NOT leak Danny's coaching client (Liam)" fail

# Check: portfolio link should NOT appear (single membership)
fetch "$RILEY" /dashboard "$TMP" >/dev/null
not_contains "$TMP" "Portfolio</a>" && check "Riley header does NOT show Portfolio link (single org)" ok || check "Riley header does NOT show Portfolio link (single org)" fail

# Direct attempt to switch into another org (should fail or at minimum not change visible data)
NORTHSTAR_ID=$(node --experimental-sqlite -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/quorum.db');
const r = db.prepare('SELECT id FROM Organization WHERE slug = ?').get('northstar-grid');
process.stdout.write(r ? r.id : '');
db.close();
" 2>/dev/null)

# Try posting a switchOrganization action with Riley's cookies and Northstar's orgId
# Server actions require special headers; this should fail gracefully OR not pollute his session
# Easier check: directly tamper with the cookie value to point at Northstar's id and verify dashboard still shows Acme
COPIED="$COOKIES_DIR/riley-tampered.txt"
cp "$RILEY" "$COPIED"
echo "localhost	FALSE	/	FALSE	0	quorum_active_org	$NORTHSTAR_ID" >> "$COPIED"
fetch "$COPIED" /dashboard "$TMP" >/dev/null
contains "$TMP" "Acme Robotics" && check "Cookie-tamper attack on Riley falls back to Acme (his real membership)" ok || check "Cookie-tamper attack on Riley falls back to Acme" fail
not_contains "$TMP" "Northstar Grid" && check "Cookie-tamper attack on Riley does NOT load Northstar" ok || check "Cookie-tamper attack on Riley does NOT load Northstar" fail

# ────────────────────────────────────────────────────────────────────────
# 2. MAYA (Northstar CEO) — must only see Northstar
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '── maya@northstar.demo (Northstar CEO) ──')"
MAYA=$(login "maya@northstar.demo")

fetch "$MAYA" /dashboard "$TMP" >/dev/null
contains "$TMP" "Northstar Grid" && check "Maya dashboard shows Northstar" ok || check "Maya dashboard shows Northstar" fail
not_contains "$TMP" "Acme Robotics" && check "Maya dashboard does NOT leak Acme" ok || check "Maya dashboard does NOT leak Acme" fail
not_contains "$TMP" "Harbor Logics" && check "Maya dashboard does NOT leak Harbor" ok || check "Maya dashboard does NOT leak Harbor" fail

fetch "$MAYA" /meetings "$TMP" >/dev/null
contains "$TMP" "Northstar" && check "Maya meetings shows Northstar meetings" ok || check "Maya meetings shows Northstar meetings" fail
not_contains "$TMP" "Acme Q1" && check "Maya meetings does NOT leak Acme meetings" ok || check "Maya meetings does NOT leak Acme meetings" fail

fetch "$MAYA" /resolutions "$TMP" >/dev/null
contains "$TMP" "seed financing" && check "Maya sees Northstar seed resolution" ok || check "Maya sees Northstar seed resolution" fail
not_contains "$TMP" "operating budget" && check "Maya does NOT see Acme budget resolution" ok || check "Maya does NOT see Acme budget resolution" fail
not_contains "$TMP" "German market" && check "Maya does NOT see Harbor Germany resolution" ok || check "Maya does NOT see Harbor Germany resolution" fail

fetch "$MAYA" /financials "$TMP" >/dev/null
contains "$TMP" "Seed-to-Series-A Plan" && check "Maya financials shows Northstar plan" ok || check "Maya financials shows Northstar plan" fail
not_contains "$TMP" "FY2026 Operating Plan" && check "Maya financials does NOT leak Acme plan" ok || check "Maya financials does NOT leak Acme plan" fail

fetch "$MAYA" /coaching "$TMP" >/dev/null
not_contains "$TMP" "First-Time Founder" && check "Maya does NOT see Danny's coaching programs (she's a CLIENT not the COACH)" ok || check "Maya does NOT see Danny's coaching programs" fail

# ────────────────────────────────────────────────────────────────────────
# 3. LIAM (Harbor CEO) — must only see Harbor
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '── liam@harbor.demo (Harbor CEO) ──')"
LIAM=$(login "liam@harbor.demo")

fetch "$LIAM" /dashboard "$TMP" >/dev/null
contains "$TMP" "Harbor Logics" && check "Liam dashboard shows Harbor" ok || check "Liam dashboard shows Harbor" fail
not_contains "$TMP" "Acme Robotics" && check "Liam dashboard does NOT leak Acme" ok || check "Liam dashboard does NOT leak Acme" fail
not_contains "$TMP" "Northstar Grid" && check "Liam dashboard does NOT leak Northstar" ok || check "Liam dashboard does NOT leak Northstar" fail

fetch "$LIAM" /financials "$TMP" >/dev/null
contains "$TMP" "Germany Expansion" && check "Liam financials shows Harbor plan" ok || check "Liam financials shows Harbor plan" fail
not_contains "$TMP" "Seed-to-Series-A Plan" && check "Liam financials does NOT leak Northstar plan" ok || check "Liam financials does NOT leak Northstar plan" fail

fetch "$LIAM" /coaching/clients "$TMP" >/dev/null
not_contains "$TMP" "Maya Okonkwo" && check "Liam clients does NOT leak Danny's other client" ok || check "Liam clients does NOT leak Maya" fail

# ────────────────────────────────────────────────────────────────────────
# 4. DANNY (cross-portfolio advisor)
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '── danny@sidequest.demo (Cross-portfolio advisor) ──')"
DANNY=$(login "danny@sidequest.demo")

fetch "$DANNY" /portfolio "$TMP" >/dev/null
contains "$TMP" "Acme Robotics" && check "Danny portfolio lists Acme" ok || check "Danny portfolio lists Acme" fail
contains "$TMP" "Northstar Grid" && check "Danny portfolio lists Northstar" ok || check "Danny portfolio lists Northstar" fail
contains "$TMP" "Harbor Logics" && check "Danny portfolio lists Harbor" ok || check "Danny portfolio lists Harbor" fail

# Danny defaults to first membership (alphabetical org name = Acme)
fetch "$DANNY" /dashboard "$TMP" >/dev/null
contains "$TMP" "Acme Robotics" && check "Danny dashboard defaults to Acme" ok || check "Danny dashboard defaults to Acme" fail

# Switch to Northstar via cookie (simulating the org switcher) and re-check
ACME_ID=$(node --experimental-sqlite -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/quorum.db');
const r = db.prepare('SELECT id FROM Organization WHERE slug = ?').get('acme-robotics');
process.stdout.write(r ? r.id : '');
db.close();
" 2>/dev/null)
HARBOR_ID=$(node --experimental-sqlite -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/quorum.db');
const r = db.prepare('SELECT id FROM Organization WHERE slug = ?').get('harbor-logics');
process.stdout.write(r ? r.id : '');
db.close();
" 2>/dev/null)

DANNY_NS="$COOKIES_DIR/danny-northstar.txt"
cp "$DANNY" "$DANNY_NS"
echo "localhost	FALSE	/	FALSE	0	quorum_active_org	$NORTHSTAR_ID" >> "$DANNY_NS"
fetch "$DANNY_NS" /dashboard "$TMP" >/dev/null
contains "$TMP" "Northstar Grid" && check "Danny can enter Northstar workspace via cookie switch" ok || check "Danny enter Northstar fail" fail
# Same caveat: org names appear in the switcher; check page content instead.
fetch "$DANNY_NS" /financials "$TMP" >/dev/null
not_contains "$TMP" "FY2026 Operating Plan" && check "Danny in Northstar financials does NOT leak Acme plan" ok || check "Danny in Northstar financials still leaks Acme plan" fail
not_contains "$TMP" "Germany Expansion" && check "Danny in Northstar financials does NOT leak Harbor plan" ok || check "Danny in Northstar financials leaks Harbor" fail
contains "$TMP" "Seed-to-Series-A Plan" && check "Danny in Northstar financials shows Northstar plan" ok || check "Danny in Northstar financials missing Northstar plan" fail

DANNY_HB="$COOKIES_DIR/danny-harbor.txt"
cp "$DANNY" "$DANNY_HB"
echo "localhost	FALSE	/	FALSE	0	quorum_active_org	$HARBOR_ID" >> "$DANNY_HB"
fetch "$DANNY_HB" /dashboard "$TMP" >/dev/null
contains "$TMP" "Harbor Logics" && check "Danny can enter Harbor workspace via cookie switch" ok || check "Danny enter Harbor fail" fail
# NOTE: "Northstar Grid" legitimately appears in Danny's org-switcher dropdown.
# What we really want to verify is that the dashboard *content* (meetings, plans,
# resolutions, action items) is Harbor's, not Northstar's.
fetch "$DANNY_HB" /financials "$TMP" >/dev/null
not_contains "$TMP" "Seed-to-Series-A Plan" && check "Danny in Harbor financials does NOT leak Northstar plan" ok || check "Danny in Harbor financials still leaks Northstar plan" fail
contains "$TMP" "Germany Expansion" && check "Danny in Harbor financials shows Harbor plan" ok || check "Danny in Harbor financials missing Harbor plan" fail
fetch "$DANNY_HB" /meetings "$TMP" >/dev/null
not_contains "$TMP" "Northstar — Seed" && check "Danny in Harbor meetings does NOT leak Northstar seed meeting" ok || check "Danny in Harbor meetings leaks Northstar" fail

# Coaching follows Danny across orgs (it's tied to the user, not org)
fetch "$DANNY" /coaching "$TMP" >/dev/null
contains "$TMP" "First-Time Founder Fundamentals" && check "Danny sees his own coaching programs" ok || check "Danny sees his own coaching programs" fail
fetch "$DANNY_NS" /coaching "$TMP" >/dev/null
contains "$TMP" "First-Time Founder Fundamentals" && check "Danny's coaching follows him across orgs (tied to user not org)" ok || check "Danny's coaching follows him across orgs" fail

# ────────────────────────────────────────────────────────────────────────
# 5. UNAUTHENTICATED — protected pages must redirect
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '── unauthenticated ──')"
EMPTY="$COOKIES_DIR/empty.txt"
touch "$EMPTY"
for path in /dashboard /meetings /resolutions /financials /coaching /retreats /portfolio; do
  CODE=$(curl -s -b "$EMPTY" -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$CODE" == "307" || "$CODE" == "302" ]]; then
    check "Unauthenticated $path -> redirect (http $CODE)" ok
  else
    check "Unauthenticated $path -> expected redirect, got $CODE" fail
  fi
done

# ────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────
echo
echo "$(yellow '──── results ────')"
echo "  passed: $(green "$PASS")"
echo "  failed: $(red "$FAIL")"
if [[ $FAIL -gt 0 ]]; then
  echo
  echo "$(red 'Failures:')"
  for line in "${FAIL_LINES[@]}"; do
    echo "  - $line"
  done
  exit 1
fi
echo "$(green 'All isolation tests passed.')"
