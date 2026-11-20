# chat launcher

Launcher that opens chat apps by deep link (chatlauncher://) with a universal QR/barcode scanner.

## Stack
- Monorepo: `expo-app/` (Android app, Expo), `extension/` (browser), `desktop/` (Tauri v2)
- Tests: `node --test tests/*.test.js`; local server `node tools/serve.mjs`
- `dist/` holds built web assets

## Commands
```
npm test          # node:test suite
npm run serve     # local preview server
npm run icons     # regenerate launcher icons
npm run shots     # screenshot set
```

## Desktop (Tauri) - important
`desktop/src-tauri` has **never been built on this machine**: no Rust toolchain and no
MSVC C++ build tools are installed, and C: has too little free space for the ~4 GB toolchain.
Build it in GitHub Actions (windows-latest ships Rust + MSVC) rather than locally.
Tauri config: productName `Chat Launcher`, version 2.1.0, bundle target `nsis`, frontend is the
static `desktop/src/index.html` (no Node build step). Auto-update is live: the app checks the
signed `desktop-latest` release feed (`latest.json`) at launch and from the tray.

## State you must know
- v2.1.0 on `main` (web + desktop; the Android shell stays at 2.0.2 / versionCode 8 until a
  native change needs an APK).
- Pages deploys through `.github/workflows/pages.yml` and also publishes a signed self-hosted
  F-Droid repo at `/chat-launcher/fdroid/repo` (see `docs/FDROID-REPO.md`).
- `docs/SESSION-HANDOFF.md`, `PHONE-INSTALL.md`, `SECURITY-AUDIT.md`, `FDROID-REPO.md` hold context.

## Rules
Read `~/.codex/AGENTS.md` first. Deep-link handling must stay validated - reject unknown schemes
rather than passing them through. Shared context in the Obsidian vault.
