# Security Audit & Bug Hunt — Chat Launcher v1.0–v1.2

*Audit dates: 2026-10-25 (v1.0) · 2026-10-26 (v1.1, v1.2) · Scope: entire
repository (web app, service worker, Expo shell, tooling, CI/CD, release
pipeline) · Method: manual source-to-sink review plus automated adversarial
probes (`tools/bug-hunt.mjs`, 9/9 passing) and unit tests (55/55).*

Every answer below is backed by evidence (file + probe), not assumptions.

---

## Q1 — Can attacker-controlled input execute JavaScript in the page (DOM XSS)?

**No — verified by probe.** The app renders hostile URL parameters
(`?number=<img src=x onerror=alert(1)>`, the same payload in `?text=`,
`?title=`, `?app=`) and reports **0 alerts, 0 evals, 0 injected elements**.

Why it holds:
- The **only** `innerHTML` in the codebase feeds from a static, hand-written
  registry (`js/main.js` → `app.icon`, icons defined in `js/apps.js`). No user
  or URL data ever reaches it.
- Everything else is built with `document.createElement` + `textContent`
  (toasts, tiles, history chips, menus, dialogs) — `textContent` cannot
  execute markup.
- `js/main.js` `consumeParams()` treats parameters as plain strings; numbers go
  through `digitsOnly()` before any use.

## Q2 — Can URL parameters cause navigation to attacker URLs?

**No — verified by probe.** `?app=javascript:alert(1)` selects no tile
(highlighted count = 0) because `getApp()` only matches the nine registry IDs.
Launch URLs are constructed exclusively from:
- a validated digit string (`isValid()`: `/^[1-9]\d{6,14}$/`), and
- hardcoded schemes/hosts per target in `js/apps.js`.

A `javascript:` URL cannot be produced by construction. Probe: invalid numbers
trigger a shake + toast and **zero** `window.open` / `location.href` calls.

## Q3 — Is message encoding correct (no parameter-context escape)?

**Yes.** All message text passes through `encodeURIComponent` exactly once in
`js/apps.js` `buildUrl()` — asserted by unit tests with hostile payloads
(`a&b=c #1`, `C++`, `50% off!`, emoji). The signal.me fragment and the Viber
`number` param also encode their `+`.

## Q4 — Is the Content-Security-Policy airtight?

**Yes, and tightened during this audit.** Final policy:
`script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none';
frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.

- No inline handlers, no `style=` attributes, no inline `<script>` (verified by
  grep; the one inline style found was moved to the stylesheet).
- `style-src 'unsafe-inline'` was **removed** in this audit after confirming
  zero `style=""` attributes — JS uses the CSSOM (`el.style.*`), which CSP does
  not govern.
- `connect-src 'none'` makes every page-side `fetch`/XHR/beacon impossible —
  probe-verified: the page cannot even fetch its own manifest.
- `base-uri 'none'` + `form-action 'none'` close injection-into-URL paths.
- Probe: full normal use under the strict policy produces **zero CSP errors**.

## Q5 — What can the service worker do; can it be abused?

- Cache-first, same-origin GETs only; non-GET and cross-origin requests are
  ignored (`sw.js`). Only the server itself could poison the cache.
- Navigation fallback serves the cached shell when offline (expected PWA
  behavior; URL params are lost offline — cosmetic, not a security issue).
- The update flow reloads only when an **updated** worker takes over (a
  first-install reload flash was found and fixed in this audit).

## Q6 — Is localStorage handling safe (injection, prototype pollution, corruption)?

**Yes — verified by probe.** The app was booted with a poisoned store:
`{"__proto__":{"polluted":"yes"}…},,not json` in the history key and
`{"theme":"<script>","order":["nope"],…}` in settings. Result: clean boot,
9 tiles, `Object.prototype` untouched, theme falls back to a safe value.

Mechanisms: `JSON.parse` cannot pollute `Object.prototype` by itself and the
code never merges parsed objects; history entries are re-validated against
`/^\d{7,15}$/`; settings fields are whitelisted; corrupt JSON degrades to
empty; user labels are length-clamped and rendered via `textContent`.
A storage-quota or private-mode failure degrades silently with a one-time
toast (in-memory fallback).

## Q7 — Do the privacy claims hold (no tracking, nothing leaves the device)?

**Yes.** No `fetch`/XHR/WebSocket/`sendBeacon` exists in app code (grep-verified);
`connect-src 'none'` would block any that were added accidentally; the only
outbound navigation is the deep link the user taps; `<meta name="referrer"
content="no-referrer">` strips the referrer; new-tab launches sever
`window.opener`. History/settings live in `localStorage` under
`chatlauncher:*` and a "Wipe all local data" control removes them.

## Q8 — What about the Android (Expo) shell?

- Permissions: `INTERNET` (implicit) + `VIBRATE` only.
- `allowBackup` default is fine: the shell stores no secrets; all PWA state is
  Chrome-managed browser storage, not app-private data.
- The shell holds no UI or data; it loads the live site over HTTPS and forwards
  external links to the OS via `Linking` (`expo-app/App.js`).
- The signing keystore is generated by EAS in Expo's cloud and never enters
  this repository.

## Q9 — Are there secrets or personal data in the repository?

**No.** Scans (regex for API keys, PATs, private-key blocks, personal emails;
token-literal grep for the deployment token) come back clean across every
committable file, and the git history was push-gated on the same checks.
Commit identity uses the GitHub noreply email. The Expo access token lives
only in the local user environment (`EXPO_TOKEN`) and EAS's own secret store.

## Q10 — Supply chain: is "zero dependencies" true?

At runtime, yes: `package.json` has **no `dependencies`** — the app is served
as static files, no CDN, no analytics. `puppeteer-core` is a devDependency used
only by the screenshot/bug-hunt tooling and is never part of the site. The Expo
shell declares `expo`, `react-native`, `react-native-webview` (audited via
`npm audit` on install; no critical advisories at build time).

### v1.2 addition — the vendored QR library

`js/vendor/qrcode-generator.js` is the only third-party code running in the
page: the well-known `qrcode-generator` package (Kazuhiko Arase, MIT, fetched
unmodified from npm/jsDelivr at a pinned version). Review findings:

- **Pure computation, no network, no eval, no DOM writes.** Its only inputs
  are the string passed by `js/qr.js` (always our own share URL — never user
  text) and the error-correction level.
- Loaded as a classic local script; CSP `script-src 'self'` covers it. Probes
  confirm zero CSP violations with the vendor script active.
- The QR payload is `window.location`-derived, so a hostile `?number=` cannot
  smuggle an arbitrary URL into someone else's phone scan — the worst case is
  a QR containing the attacker's own number parameter, which only opens the
  launcher pre-filled (same as sending the link).

### v1.2 additions — new modules

`js/i18n.js` (string tables + `t()` interpolation via replaceAll — no HTML
generation), `js/stats.js` (aggregate counters with junk-key stripping and
corrupt-JSON degradation — unit-tested), and the bulk-launch parser reuse the
same hardened patterns: textContent rendering, clamped lengths, digit-only
normalization. The adversarial probe suite still passes 9/9 against the full
v1.2 UI.

---

## CI/CD pipeline security

- **Secrets:** `EXPO_TOKEN` lives only in (a) the local Windows user
  environment and (b) GitHub Actions secrets (sealed-box encrypted, write-only
  to workflows). It appears in no file and no log. Rotate it at expo.dev if it
  was ever exposed in plaintext (e.g. chat).
- **Least-privilege workflows:** `ci.yml` has no secrets and needs none;
  `release.yml` only gets `EXPO_TOKEN` + the built-in `contents:write` token,
  and runs only on `v*` tags.
- **Known accepted risks:** Dependabot flags `zod` and `node-forge` inside
  Expo's local CLI tooling (transitive dev-only; the site ships zero deps and
  EAS builds in Expo's cloud). Forcing overrides there risks breaking the
  build chain; tracked upstream instead.

---

## Bug hunt — defects found and fixed during this audit

| # | Severity | Defect | Fix |
|---|---|---|---|
| 1 | **High** (functional) | `window.open(url, '_blank', 'noopener')` always returns `null`, so the "popup blocked" fallback fired on every launch and the chat opened **twice** | Detect custom schemes and navigate directly; open web links without `noopener` and sever `window.opener` instead |
| 2 | Medium (UX) | First service-worker install triggered `controllerchange` → immediate page reload (flash) | Reload only when a *previously controlled* page receives a new worker |
| 3 | Medium (functional) | `?number=…&text=…` deep links dropped the pre-filled message | Message now applies for explicit deep links; only share-target texts that *were* mined as numbers skip it |
| 4 | Low (hardening) | `style-src 'unsafe-inline'` was broader than needed | Removed after eliminating the single inline style |
| 5 | Low (data hygiene) | Trunk-zero heuristic ate short national numbers (`toE164('91','911234567')`) | Threshold raised; regression-tested |
| 6 | Low (ordering) | Same-millisecond history entries sorted unstably | Monotonic `seq` tiebreaker; regression-tested |

## Verdict

| Area | Verdict |
|---|---|
| DOM XSS | **PASS** (probe-verified) |
| URL parameter abuse | **PASS** (probe-verified) |
| Secrets / personal data in repo | **PASS** (scan-verified) |
| Privacy claims accuracy | **PASS** (source- + probe-verified) |
| Prototype pollution / storage corruption | **PASS** (probe-verified) |

**Remaining known limitations (by design, documented in the README):** LINE and
Threema cannot open a chat by phone number (platform restriction, labeled
"app only"); iOS SMS body separators are sniffed by user-agent, which is
best-effort by nature.
