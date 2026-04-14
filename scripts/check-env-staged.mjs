#!/usr/bin/env node
// ── Block staged .env files at pre-commit ────────────────────────────
//
// Fails the commit if any of these secrets-bearing files are staged:
//   .env, .env.local, .env.production, .env.*.local
//
// Works against both regular and force-added entries (git add -f).
// Exits 0 if none are staged, 1 with an actionable message otherwise.

import { execSync } from 'node:child_process';

const FORBIDDEN_EXACT = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.staging',
]);

// Matches `.env.*.local` (e.g. .env.development.local).
const FORBIDDEN_PATTERN = /(^|\/)\.env\.[^/]+\.local$/;

function isForbidden(path) {
  const basename = path.split('/').pop() ?? path;
  return FORBIDDEN_EXACT.has(basename) || FORBIDDEN_PATTERN.test(path);
}

function stagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    console.error('[check-env-staged] failed to read git index:', err.message);
    process.exit(2);
  }
}

const offenders = stagedFiles().filter(isForbidden);

if (offenders.length > 0) {
  console.error('\nCommit blocked: the following secrets-bearing files are staged:');
  for (const f of offenders) console.error(`  - ${f}`);
  console.error('\nUnstage them with:');
  for (const f of offenders) console.error(`  git restore --staged ${f}`);
  console.error('\nIf you truly need to commit this file, rename it (e.g. .env.example) first.\n');
  process.exit(1);
}
