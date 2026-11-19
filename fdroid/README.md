# F-Droid packaging

`metadata/io.github.avithegod2010.chatlauncher.yml` follows the
[fdroiddata](https://gitlab.com/fdroid/fdroiddata) metadata format.

## Two honest paths

1. **Official F-Droid inclusion (fdroiddata merge request).** F-Droid builds
   apps from source in their own runners. The metadata's `Builds:` block now
   records that path — `expo prebuild` (CNG) followed by a plain
   `./gradlew assembleRelease` — and `.github/workflows/android-source.yml`
   builds exactly that on every `expo-app/**` push, so the source is proven
   buildable without EAS before reviewers ask. The `Binaries:` line points at
   the EAS-signed release APK so F-Droid can compare what they build with
   what users install. Reviewers still decide whether they accept the
   EAS-signed binary as the reference artifact.

2. **Self-hosted F-Droid repo (faster, no gatekeeper).** Chat Launcher
   already publishes one from GitHub Pages:
   <https://avithegod2010.github.io/chat-launcher/fdroid/repo>.
   `.github/workflows/pages.yml` builds it on every push/release — it
   downloads the release APK, runs `fdroid update` with a repo key stored as
   GitHub Actions secrets, and deploys the signed index with the site. See
   [`docs/FDROID-REPO.md`](../docs/FDROID-REPO.md) for the client steps and
   the key-backup rules. That gives users a real auto-updating F-Droid client
   feed without Play Store or EAS dependency.

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
