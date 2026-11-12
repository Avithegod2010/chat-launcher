# fastlane

Play Store submission tooling that lives next to the EAS pipeline. EAS Build
produces the signed AAB (`eas build --profile production`); these lanes upload
it plus store metadata via `supply`.

## Prerequisites

- `GOOGLE_SERVICE_ACCOUNT_JSON` env var (or `--json_key` path) with Play
  Console API access, role **Service Account → Release manager**
- The package `io.github.avithegod2010.chatlauncher` must exist in Play
  Console (create it once manually — the API cannot create apps)

## Lanes

```sh
fastlane android production          # upload AAB + metadata to the production track
fastlane android internal            # upload to the internal testing track
fastlane android metadata_only       # push screenshots-free metadata (titles, notes)
```

Store copy lives in `fastlane/metadata/android/en-US/` — release notes are
copied from the repo CHANGELOG when you run the lane.
