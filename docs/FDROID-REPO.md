# Self-hosted F-Droid repo

Chat Launcher publishes its own signed F-Droid repository from GitHub Pages:

```
https://avithegod2010.github.io/chat-launcher/fdroid/repo
```

## Add it to the F-Droid client

1. F-Droid → **Settings → Repositories → +**
2. Paste the URL above and tap **Add**
3. Refresh the catalogue; **Chat Launcher** appears with the current APK

The client pins the repository's signing certificate the first time it reads
the index. Future indexes must be signed with the same key or they are
rejected — that is the point.

## How it is built

`.github/workflows/pages.yml` runs on every push to `main`, on every
published release, and on demand (`workflow_dispatch`). It:

1. assembles the site from the tracked tree (`git archive HEAD`) — no
   `node_modules`, no local artifacts;
2. downloads the APK for the current `expo-app/app.json` version from its
   release (`v<version>/app-release.apk`);
3. installs `fdroidserver` in a throwaway venv, writes `fdroid/config.yml`
   from the secrets below, and runs `fdroid update` — which reads
   `fdroid/metadata/`, extracts the APK's metadata, generates icons and
   writes a **signed** `index-v1.jar` + `index-v1.json`;
4. copies the result to `/fdroid/repo/` inside the Pages artifact and
   deploys it.

The APK is never committed to git; only the pages artifact carries it. The
repo keeps the newest APK only (`archive_older: 0`).

If the F-Droid step fails, the run shows a warning and the **site still
deploys** — the repo URL then serves the previous index until the next green
run.

## Secrets

| Secret | What |
|---|---|
| `FDROID_KEYSTORE_B64` | base64 of the PKCS#12 repo keystore (`keystore.p12`) |
| `FDROID_KEYSTORE_PASS` | store password (same value is used as the key password) |

The key alias is `chatlauncher`, the keystore is PKCS#12, RSA-4096,
self-signed, valid for ~27 years.

**Back the keystore and password up.** They live in the repository secrets
and in `dist/fdroid-repo/` locally (gitignored). If they are lost, every
index after that cannot be trusted by clients that already added the repo —
users would have to remove and re-add it. If they leak, someone could sign a
malicious index for those users.

To rotate the key (and accept the re-add requirement):

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -days 10000 -nodes -subj "/CN=Chat Launcher F-Droid Repository/O=Chat Launcher" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=codeSigning"
openssl pkcs12 -export -inkey key.pem -in cert.pem -out keystore.p12 \
  -name chatlauncher -passout pass:<password>
base64 -w0 keystore.p12   # → FDROID_KEYSTORE_B64
```

## Local run

```bash
cp fdroid/config.yml.example fdroid/config.yml   # fill in a keystore
mkdir -p fdroid/repo && cp <apk> fdroid/repo/
cd fdroid && fdroid update --verbose             # needs fdroidserver + java
```

`fdroid/repo/` and `fdroid/config.yml` are gitignored.
