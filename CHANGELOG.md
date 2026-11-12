# Changelog

All notable changes to Chat Launcher. Newest entries are prepended
automatically by the release workflow from each GitHub Release's notes.

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
