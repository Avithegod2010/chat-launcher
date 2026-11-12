# Changelog

All notable changes to Chat Launcher. Newest entries are prepended
automatically by the release workflow from each GitHub Release's notes.

## [v2.0.0] — 2026-11-13

The big one: the 20-item "Native + Sync" roadmap, end to end.

### Web app
- **Camera scanner** — in-app QR/MeCard/barcode scanning via the Web `BarcodeDetector` API (no native dependency); parses `tel:`, `wa.me`, `?number=` URLs, vCard `TEL` lines and bare numbers into the input
- **End-to-end encrypted sync** — passphrase → PBKDF2 (310k) → AES-GCM; push/pull to your own WebDAV server (Nextcloud-compatible); the server only ever sees ciphertext; pull merges without clobbering newer local data
- **Message templates** — reusable texts with `{name} {number} {app} {date} {time}` variables, managed in settings, quick-inserted as chips, expanded at launch
- **Broadcast lists** — named number groups (20 × 200) with RFC-4180 CSV import/export and "open all on…" staggered launching
- **Smart suggestion** — per-number last-app, global usage and time-of-day buckets (new `stats.byHour`) highlight the likely tile (✦ badge); display-only
- **Command palette** — `Ctrl/⌘+K`: launch apps, run actions, open history entries, switch language/theme, insert templates
- **Contact avatars** — the shell's contact picker now carries the photo into history chips; desktop shows initials avatars
- **Design system v2** — motion tokens (`--m-fast/med/slow`, easing pairs), View Transitions on theme/accent/language changes, drag-to-dismiss country sheet, large-text mode and high-contrast surfaces (plus `prefers-contrast` support)
- **12 languages** — added Deutsch, Français, Português, Русский, 日本語; genuine key-parity test across all tables

### Android shell
- **Home-screen widget** (4×2) — mirrors your top 3 history targets, taps deep-link into the launcher (`react-native-android-widget` + AsyncStorage bridge)
- **Quick Settings tile** — notification-shade shortcut via a small Kotlin TileService config plugin
- **Share-in** — `expo-share-intent`: text shared from any app lands in the launcher and the number is extracted
- **Scheduled chats** — `expo-notifications` reminders whose tap opens the pre-filled deep link
- **Contact picker v2** — photos and names now ride the bridge into history

### Platform & distribution
- **Browser extension** (`extension/`, MV3) — selection pill, context-menu launch, options page to point at a custom deployment, zero-dependency zip packer
- **Tauri desktop v2** — tray icon (Show/Quit), clipboard watcher (copy a number anywhere → launcher opens pre-filled), updater plugin wired
- **iOS profile** — EAS production profile + submit env plumbing (needs an Apple Developer account to run)
- **Play Store tooling** — fastlane lanes (`internal`/`production`/`metadata_only`) + store metadata
- **Supply-chain hardening** — CycloneDX SBOMs on every release, build-provenance attestations for the APK, Dependabot config for npm + GitHub Actions, Expo patch bump, extension icon pipeline

### Security
- CSP `connect-src` relaxed from `'none'` to `'self' https:` — only so the opt-in sync can reach a user-configured server; the app itself still fetches nothing (documented in `docs/SECURITY-AUDIT.md`)
- New adversarial probes: hostile history labels through the palette, and shell-bridge message floods (proto-pollution, huge payloads, javascript: URLs) — all inert
- Sync envelope tampering and wrong passphrases are rejected by GCM auth; merge paths re-validate payloads through the strict backup sanitizer

### Numbers
- 104 unit/property tests · 11 adversarial probes · 17 e2e journeys · bundle budget raised to accommodate 12 languages (404 KB / 520 KB precached)

## [v1.3.1] — 2026-11-12

### Fixed
- **App icon** — icons are now rendered from the real artwork: full rounded gradient square, white bubble, three dots. Fixed the rounded-rect mask (the artwork was shrunk to ~56 % of the canvas and clipped), three dots instead of two, and a compositing bug that painted the background white.
- **Android adaptive icon** — gradient background layer plus a transparent foreground whose dots are holes, so the launcher icon matches the in-app logo.
- **Header brand** — renders `icons/icon.svg` (the same artwork as the install/launcher icon) instead of an approximation.
- **Settings overlap** — the seven language pills no longer squeeze into one row and overlap; they wrap in a centred 3-column grid with ellipsis.
- **Hero actions** — the row wraps instead of clipping “+ Message” under “Dial pad” on narrow screens.
- **Custom accent picker** — the colour input is re-appended after the swatch re-render (it disappeared after the first render).
- **Changelog workflow** — inserts new entries before the first `## [` heading and ignores a missing release instead of committing the API error JSON.

## [v1.3.0] — 2026-11-12

The big one: 24 items from the roadmap, end to end.

### Web app
- **Per-country digit grouping** — `98765 43210` (India), `555 123 4567` (US), NANP short numbers, per-country cache
- **History search** — filter by number, label, note or app name
- **Per-entry default messenger** — pick a default app per number; a coloured dot shows what you last used; refilling an entry sets Enter's target
- **Backup & restore** — export settings/history/stats as a versioned JSON file; import re-validates every field
- **Unusual-length confirm** — odd lengths ask “Open anyway?” instead of silently launching
- **Custom accent colour** — colour picker derives a matching gradient pair (HSL math, tested)
- **vCard import** — `.vcf` via file picker or drag & drop, names preserved
- **Error boundary** — unexpected failures show a toast with a reload action
- **Offline share queue** — numbers shared while offline wait for connectivity, then one-tap launch
- **Five new languages + RTL** — Español, العربية (RTL), मराठी, বাংলা, தமிழ் (+ en/hi) = 7 languages

### Android shell
- **Native contact picker** — floating 👤 button opens your contacts; the picked number lands in the input via a guarded bridge
- **Dynamic launcher shortcuts** — long-press the app for your top 3 most-used numbers, kept in sync from history

### Desktop & distribution
- **Tauri desktop shell** — `desktop/`, ~2 MB window with a `Ctrl+Shift+C` global hotkey (build needs the Rust toolchain)
- **F-Droid metadata** + local linter + submission notes

### Automation
- CI now runs **74 unit/property tests, 9 adversarial probes, 11 e2e journeys**, bundle-size budget, F-Droid lint, and a **Lighthouse budget job**
- Release workflow **prepends CHANGELOG.md** from the release notes, attaches **SHA256SUMS**, and can **submit to Play** when a service-account secret exists
- Manual **reproducibility workflow** builds the same commit twice and compares APK hashes

### Android APK status
The Expo free plan's monthly Android build quota was exhausted (resets **Dec 1, 2026**), so the v1.3.0 tag shipped without a fresh APK. The release workflow (tag → EAS build → APK + SHA256SUMS attached) is fully wired; the installed shell already shows every web feature because it loads the live site.

## [v1.2.0] — 2026-10-26
