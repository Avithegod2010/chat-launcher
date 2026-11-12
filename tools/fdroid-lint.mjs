/**
 * Lightweight F-Droid metadata validator (#22).
 * Checks the fdroiddata YAML for required fields, sane values and URL shape.
 * This is a fast local guard — `fdroid lint` from fdroidserver remains the
 * authoritative check before submitting to fdroiddata.
 *
 * Usage: node tools/fdroid-lint.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'fdroid', 'metadata');

const REQUIRED = ['Categories', 'License', 'AuthorName', 'WebSite', 'SourceCode', 'Summary', 'Description', 'RepoType', 'Repo', 'CurrentVersion', 'CurrentVersionCode'];
const URL_FIELDS = ['WebSite', 'SourceCode', 'IssueTracker', 'Changelog', 'Binaries', 'Repo'];

let failed = 0;
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));
if (!files.length) {
  console.error('no metadata files found in fdroid/metadata');
  process.exit(1);
}

for (const file of files) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const problems = [];

  for (const field of REQUIRED) {
    if (!new RegExp(`^${field}:`, 'm').test(text)) problems.push(`missing ${field}`);
  }
  if (!/^License: (MIT|Apache-2.0|GPL-3.0|BSD-3-Clause)$/m.test(text)) {
    problems.push('License missing or not a known SPDX id');
  }
  if (!/^Summary: .{10,80}$/m.test(text)) problems.push('Summary must be 10–80 chars on one line');
  if (!/^AutoName: /m.test(text)) problems.push('missing AutoName');
  if (!/^RepoType: git$/m.test(text)) problems.push('RepoType should be "git"');
  if (!/^UpdateCheckMode: Tags$/m.test(text)) problems.push('UpdateCheckMode should be "Tags"');
  if (!/^CurrentVersionCode: \d+$/m.test(text)) problems.push('CurrentVersionCode should be numeric');

  for (const field of URL_FIELDS) {
    const m = text.match(new RegExp(`^${field}: (.+)$`, 'm'));
    if (m && !/^https?:\/\/[^\s]+$/.test(m[1].trim())) {
      problems.push(`${field} is not a well-formed URL: ${m[1]}`);
    }
  }

  // Version/changelog consistency: CurrentVersion should look like semver.
  const v = text.match(/^CurrentVersion: (.+)$/m)?.[1]?.trim() ?? '';
  if (!/^\d+\.\d+\.\d+$/.test(v)) problems.push(`CurrentVersion is not semver: "${v}"`);

  if (problems.length) {
    failed++;
    console.error(`FAIL ${file}`);
    for (const p of problems) console.error(`  - ${p}`);
  } else {
    console.log(`OK   ${file}`);
  }
}

process.exit(failed ? 1 : 0);
