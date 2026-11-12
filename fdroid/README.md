# F-Droid packaging

`metadata/io.github.avithegod2010.chatlauncher.yml` follows the
[fdroiddata](https://gitlab.com/fdroid/fdroiddata) metadata format.

## Two honest paths

1. **Official F-Droid inclusion (fdroiddata merge request).** F-Droid builds
   apps from source in their own runners. This project's Android artifact is
   produced by **Expo EAS**, and the `Builds` block above records the EAS
   command as a best-effort attempt — the F-Droid reviewers decide whether
   that is acceptable for their trusted-builds policy. Expect them to prefer a
   fully local Gradle build (`expo prebuild` + `gradle assembleRelease`), which
   this repo can produce on a machine with the Android SDK. The metadata's
   `Binaries:` line lets F-Droid verify APK signatures even when they build.

2. **Self-hosted F-Droid repo (faster, no gatekeeper).** Serve an
   `fdroid` repo from GitHub Pages: publish `app-release.apk`, generate
   `index-v1.json` with `fdroid update`, and sign it with a repo key stored
   as a GitHub Actions secret. That gives users a real auto-updating F-Droid
   client feed without Play Store or EAS dependency.

## Lint locally

```bash
node tools/fdroid-lint.mjs
```

CI runs the same check on every push. It validates required fields, the
version/changelog pair, and that URLs are well-formed — it is not a
replacement for `fdroid lint` from `fdroidserver`.

## Before submitting

- Re-generate the APK on the tag you submit and update `Binaries:`,
  `CurrentVersion`, `CurrentVersionCode`.
- Keep `AutoName` equal to the launcher label.
- The app contains **no anti-features** (no tracking, no ads, no non-free
  assets — brand glyphs are CC0 path data from Simple Icons).
