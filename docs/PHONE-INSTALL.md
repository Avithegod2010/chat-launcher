# Installing the v2.0.0 APK on the phone

The APK is attached to [release v2.0.0](https://github.com/Avithegod2010/chat-launcher/releases/tag/v2.0.0)
(also saved locally at `dist/app-release.apk`, SHA-256 verified against
`dist/SHA256SUMS.txt`).

**It cannot upgrade the installed app in place**: the new account's keystore is
different from the old one, so Android refuses the signature mismatch. The old
app must be uninstalled first, which wipes its local data (history, settings —
it's WebView storage, bound to the app). A reconstructed backup is ready at
`/tmp/clapk/chat-launcher-backup.json` (3 history entries, emerald accent,
3 enabled tiles) — re-derive or edit it if the real data differs.

## Steps (wireless adb)

```bash
export PATH="/usr/bin:/mingw64/bin:/c/Program Files/Git/cmd:/e/Dev/nodejs:/e/Dev/android-sdk/platform-tools:$PATH"

# 1. Connect (mDNS entry usually survives; else adb connect <ip:port>)
adb devices

# 2. OPTIONAL — temporarily unblock github.io (NextDNS private DNS blocks it
#    on this network). We restore it in step 6.
adb -s <serial> shell settings put global private_dns_mode opportunistic

# 3. Uninstall the old app (DATA LOSS — the backup below restores it)
adb -s <serial> uninstall io.github.avithegod2010.chatlauncher

# 4. Install the new APK
adb -s <serial> install dist/app-release.apk

# 5. First launch — let the service worker install the live v2.0.0 site
adb -s <serial> shell am start -n io.github.avithegod2010.chatlauncher/.MainActivity
sleep 15   # repeat once more so the SW update settles
adb -s <serial> shell am force-stop io.github.avithegod2010.chatlauncher
adb -s <serial> shell am start -n io.github.avithegod2010.chatlauncher/.MainActivity

# 6. Restore the user's DNS filtering
adb -s <serial> shell settings put global private_dns_mode hostname
adb -s <serial> shell settings put global private_dns_specifier ADNS-aeaeb1.dns.nextdns.io
```

## Then verify hands-on

- Launcher icon: gradient square, white bubble, **3 dots** (the fixed artwork)
- Long-press the app icon: shortcuts (WhatsApp / Telegram / SMS)
- Home screen: add the **Chat Launcher widget** (4×2, shows top targets)
- Quick Settings shade: **Chat Launcher tile**
- Share a text containing a number from another app → lands in the launcher
- In-app: Settings → **Import data** → pick the backup JSON
- Settings footer shows `Chat Launcher v2.0.0`

## Known issue (fix queued)

The shell's WebView does not handle blob downloads — the in-app **Export data**
button silently does nothing on Android. The React Native WebView needs a
`onFileDownload` handler (`webview.setDownloadListener`) to support it.
