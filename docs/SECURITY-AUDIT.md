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
  and runs only on `v*` tags; the Play upload step is skipped unless a
  `GOOGLE_SERVICE_ACCOUNT` secret exists.
- **Known accepted risks:** Dependabot flags `zod` and `node-forge` inside
  Expo's local CLI tooling (transitive dev-only; the site ships zero deps and
  EAS builds in Expo's cloud). Forcing overrides there risks breaking the
  build chain; tracked upstream instead.

---

# v1.3 addendum — new surfaces

## Shell bridge (postMessage between PWA and Expo shell)

**Threat:** a hostile page could try to push a number into the input via a
`message` event, or trick the shell into opening something.

**Mitigations:** the page-side listener runs only when
`window.ReactNativeWebView` exists (i.e. inside our shell), the payload must
be `{type:'chatlauncher-contact', number}` with a digit-only 7–15 length
check, and the number goes through the same `parsePaste`/`setNational`
pipeline as typing. It can only pre-fill the input — it can never launch a
chat by itself. The shell side validates the same shape before showing
anything.

**History → shortcuts:** only the top three entries' `{e164, label, app}`
cross into the OS shortcut list; text is rendered by Android, not HTML.

## Contact picker (READ_CONTACTS)

Permission is requested at tap time, never on boot. Contacts are read into
memory for the picker list only, capped at 400 entries, and **nothing is
persisted** — only the single chosen number crosses into the page. No contact
data is sent anywhere (the shell has no network code besides the webview).

## Backup import

`js/backup.js` re-validates every field (history entries must match
`/^\d{7,15}$/`, labels/notes are length-clamped, settings are whitelisted by
enum, stats keys must be `[\\w-]{1,24}` with positive counts; unknown format
versions are rejected). Hostile-import unit tests assert that junk, prototype
pollution attempts and negative counters are neutralized.

## vCard import

Files are size-capped at 2 MB, parsed line-by-line with folded-line support,
and only `+E.164`-shaped numbers (7–15 digits) are accepted — local-format
numbers are skipped rather than guessed. No network access at any point.

## Offline queue

Entries match `/^\d{7,15}$/` and are capped at 5; the queue only ever holds
numbers the user already shared or launched.

## Tauri shell

The window loads the production HTTPS URL; the capability file allows remote
access only to `https://avithegod2010.github.io/*`. The global shortcut
(`Ctrl+Shift+C`) only shows/focuses the window — it executes no code from the
webview and grants no IPC beyond core defaults. The scaffold is unbuilt in CI
(no Rust toolchain on the build machine), so this is a design-level review.

## Dev-workflow note (pop-up fix)

Earlier tooling called `git credential fill` without disabling Git Credential
Manager's UI, which could spawn interactive windows. All automation now runs
with `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never` and
`git -c credential.interactive=false`, so stored credentials are read
silently and no window can open.

**Verdict (v1.3):** DOM XSS — PASS · URL param abuse — PASS · shell bridge
trust model — PASS (input-only, pre-fill) · backup/vcf/queue hostile input —
PASS (unit-tested) · secrets in repo — PASS (history scan clean) · privacy
claims — PASS (no network APIs added).

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

---

# v2.0 addendum (2026-11-13)

Q&A review of the v2.0 feature set.

## Q1. The CSP was relaxed from `connect-src 'none'` to `'self' https:` — does that break the "no tracking" guarantee?

**Verdict: PASS with documented trade-off.**
- The app itself still issues **zero** fetch/XHR/WebSocket calls; `grep -rn "fetch(" js/` shows the only fetch call sites inside `js/sync.js`, which runs exclusively on user action (Push/Pull buttons) and only toward the user-configured URL.
- `sync.assertSafeUrl` enforces **https** (plain http only for localhost), so sync traffic is always TLS-encrypted in transit — and GCM-encrypted in content regardless.
- Worst case if a future dependency tried to beacon: it could reach an https endpoint. There are no runtime dependencies (the web app is vendored ES modules), so the attack surface is the repo itself. Mitigations: SBOM + provenance attestations on every release, Dependabot, and the adversarial CSP probe that fails CI on any `unsafe-inline`/violation.

## Q2. The sync passphrase and WebDAV credentials live in localStorage — is that acceptable?

**Verdict: PASS with documented limitation.**
- The passphrase never leaves the device; the key is derived with PBKDF2-SHA256 (310k iterations, 16-byte random salt) and used as a non-extractable AES-GCM 256 key (`extractable: false`).
- The stored WebDAV password is readable by anything that can execute JS in the page origin — i.e. nothing under our CSP (`script-src 'self'`), but a compromised browser profile could read it. Mitigation for users: an app-scoped password (documented in the README privacy section).
- Sync merge paths (`mergeRemote`) never touch the network and re-validate the decrypted payload through the strict backup sanitizer before applying.

## Q3. Is the sync envelope tamper-proof?

**Verdict: PASS (probe-tested).**
- AES-GCM authentication rejects wrong passphrases and any ciphertext/IV mutation (`tests/sync.test.js` covers both, plus foreign envelopes and cross-run salt uniqueness).
- The envelope format field is checked before any crypto work; JSON.parse failures inside `pull` degrade to `{ok:false}` — never a throw into the UI (error boundary exists regardless).

## Q4. The command palette renders user-controlled history labels — injection risk?

**Verdict: PASS (probe-verified).**
- All palette items are built with `document.createElement` + `textContent`; only `item.icon` (a fixed, repo-controlled SVG string) uses innerHTML. The new adversarial probe plants a history label of `<img src=x onerror=…>` and asserts no image element and no side effect.

## Q5. The shell bridge now accepts more message types (share, schedule, contact+avatar). Hardening?

**Verdict: PASS (probe-verified).**
- Still gated on `window.ReactNativeWebView` presence (not forged from a normal browser).
- Numbers: strict `+?\d{7,15}` before any parse; avatar: `data:image/(png|jpeg|webp);base64` regex + 12 KB cap, re-validated by `history.setAvatar` *and* on backup import; name: length-capped, rendered via textContent.
- `chatlauncher-schedule` from the page goes to the shell, which clamps seconds to [60, 30 days]; the URL parameter is re-interpreted by the shell's own `isAppUrl` guard before navigation.
- New adversarial probe floods the bridge with malformed/huge/proto-polluting messages: app stays alive, prototype clean.

## Q6. Scheduled notifications — can a malicious "url" open something unexpected?

**Verdict: PASS.**
- The shell only schedules what the *page* (trusted origin, itself under strict CSP) asks for; on tap the shell re-runs `isAppUrl()` — anything outside `https://avithegod2010.github.io/chat-launcher*` is handed to the OS via `Linking.openURL` like any other external link. No credential or token is attached.

## Q7. Browser extension — permission scope?

**Verdict: PASS (minimal).**
- Permissions: `contextMenus` + `storage` only — **no** `tabs` read, no host permissions, no `webRequest`. Content script listens to selection changes locally; the only cross-context message is the selected text sent to our own service worker.
- The options page enforces https for the configurable endpoint; `openFor` builds a `?number=` URL with `encodeURIComponent`.

## Q8. New native surfaces (widget, tile, share-in) — manifest risk?

**Verdict: PASS.**
- The widget receiver and tile service carry the minimum permissions (`BIND_REMOTEVIEWS`, `BIND_QUICK_SETTINGS_TILE`); the tile opens a fixed https URL via an immutable PendingIntent.
- `expo-share-intent` adds `ACTION_SEND` mime filters for text; no data-scheme wildcard is introduced. All manifest edits go through reviewed config plugins that are unit-tested on their generated XML/Kotlin.

## Verdict table (v2.0)

| Area | Verdict |
|---|---|
| CSP relaxation rationale & blast radius | **PASS** (source-verified, documented) |
| Sync crypto (KDF, GCM, tamper) | **PASS** (unit-tested) |
| Sync merge path validation | **PASS** (unit-tested, sanitizer reuse) |
| Command palette injection | **PASS** (probe-verified) |
| Shell bridge v2 (share/schedule/avatar) | **PASS** (probe-verified) |
| Notification tap navigation | **PASS** (source-verified) |
| Extension permissions | **PASS** (minimal scope) |
| Native surfaces (widget/tile/SEND) | **PASS** (minimal permissions, tested generators) |

## v2.0.1 pre-note (2026-11-14): shell export bridge

The Export-data feature gained a shell path: the page base64s the backup and
posts `{type: 'chatlauncher-export', name, base64}` to the shell, which writes
it via expo-file-system and opens the share sheet. Hardening: base64 charset
regex + 12 MB size cap + filename regex (`^[\w.-]{1,80}$`, no traversal) —
all validated in `saveBackupFile` before any write; the payload content itself
was produced locally by the page, and the share sheet hands it to the user's
chosen target, not to any network endpoint. e2e journey 15 verifies the bridge
end-to-end against a stubbed shell.
