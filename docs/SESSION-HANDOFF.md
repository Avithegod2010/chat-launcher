# Session handoff — overnight 2026-11-13/14

Everything below is committed and pushed to `main` unless marked otherwise.
Working tree at handoff: `HEAD` = export-bridge feature (`8c5b60a` line).
CI on main: **green** (test + lighthouse best-of-3, perf 98).

## Shipped tonight

1. **v2.0.0 released with the APK** — the release
   <https://github.com/Avithegod2010/chat-launcher/releases/tag/v2.0.0>
   has `app-release.apk` (versionCode 6) + `SHA256SUMS.txt` + two CycloneDX
   SBOMs + a build-provenance attestation. Built on the **new account
   `avithegoats-team`** (fresh quota). APK manifest verified devicelessly with
   aapt2: tile service (`exported=true`), widget receiver, SEND share-in
   filters, shortcuts meta-data. A verified copy sits in `dist/`.
2. **Account migration complete** — `expo-app/app.json` now points at project
   `cef8be3e…` / slug `avithegoat-project` / owner `avithegoats-team`; the
   `EXPO_TOKEN` Actions secret is the new account's. Slug had to match the
   scaffold project the onboarding created (`eas init --force` linked it).
3. **Three build/CI fixes** were needed to get the APK out:
   - tile service missing `android:exported` (manifest merger) — fixed in
     `tile-extras.js`, regression-tested
   - root `npm ci` added to the release workflow (eas-cli 27 `npm ls` preflight)
   - lighthouse noise: best-of-3 passes + **gzip in tools/serve.mjs** (perf on
     CI went 72–77 → 98)
4. **Export-data fixed for the shell** — the page now hands backups to the
   shell as base64 over the bridge; the shell writes via expo-file-system and
   opens the share sheet (expo-sharing). Browsers keep the blob path. e2e
   journey 15 covers it. Needs the next APK to reach the phone (versionCode 7).
5. **Dependabot settled** — #3 merged; #1 obsolete (lockfile already has
   node-forge 1.4.3); #2/#4 applied directly (checkout/setup-node v7). #5
   (react 19.3.1 / RN 0.88.1) intentionally held: CI can't prove an EAS Gradle
   build; merge it only together with a build that compiles. Its checks went
   green after the gzip fix; #1 was closed as obsolete.

## Waiting on you / the morning

- **S1 note (2026-11-14):** your commit `51bba6f` was swept onto `main` by a
  later push — it's already there, nothing to re-push. The two Gradle java
  daemons exited on their own overnight (RAM at handoff: ~1.4 GB free), so the
  Rust/MSVC install has headroom now. `docs/PHONE-INSTALL.md` is new since
  your session started.
- **Phone install**: **install v2.0.1** — versionCode 7, includes the export
  fix and the dependency refresh; attached to release v2.0.1 and saved as
  `dist/app-release.apk` (v2.0.1) once the build lands. The phone's installed
  v1.0.0 was signed by the OLD account's keystore, so the one-time uninstall
  still applies. Runbook in `docs/PHONE-INSTALL.md`; backup JSON at
  `/tmp/clapk/chat-launcher-backup.json` (reconstructed from screenshots —
  check it matches reality before importing).
- **Compile-proof build**: finished clean — the export feature compiles on EAS.
  Artifact: `dist/app-export-fix-7affae7.apk` (superseded by the v2.0.1
  release build).
  If a future build errors, the EAS log (`eas build:view <id>`, logFiles URLs
  are brotli JSON) has the reason; fix and rebuild before merging further
  dependency bumps or cutting a release.
- **PR #5**: merged into v2.0.1 (react 19.3.1 / RN 0.88.1 — compiled in the
  v2.0.1 build).

## Deliberately not touched

- `desktop/` — Session 1's domain (its commit `51bba6f` is already on main).
- No Android local builds, no EAS quota spent beyond one compile-proof build,
  no releases cut beyond v2.0.0, no destructive git operations.
