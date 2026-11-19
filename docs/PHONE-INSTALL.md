# Installing / updating the Chat Launcher APK

Current install target: **v2.0.2** (versionCode 8). It is attached to
[release v2.0.2](https://github.com/Avithegod2010/chat-launcher/releases/tag/v2.0.2)
and kept locally at `dist/app-release.apk`, SHA-256 verified against
`dist/SHA256SUMS.txt`.

## Upgrade rules

| Installed version | Action |
|---|---|
| v2.0.0 – v2.0.2 (all signed by the `avithegoats-team` keystore) | **Install straight over it** — no uninstall, data kept |
| v1.0.0 (old account's keystore) | One-time **uninstall first** — signature mismatch; this wipes WebView storage (history, settings), so import a backup afterwards |

## Steps (wireless adb)

```bash
export PATH="/usr/bin:/mingw64/bin:/c/Program Files/Git/cmd:/e/Dev/nodejs:/e/Dev/android-sdk/platform-tools:$PATH"

# 1. Connect (mDNS entry usually survives; else adb connect <ip:port>)
adb devices

# 2. ONLY if this network blocks github.io (NextDNS private DNS), unblock
#    temporarily. Restore it in step 4.
adb -s <serial> shell settings put global private_dns_mode opportunistic

# 3. Install. Add the uninstall line only when coming from v1.0.0:
#    adb -s <serial> uninstall io.github.avithegod2010.chatlauncher
adb -s <serial> install -r dist/app-release.apk

#    First launch (twice, so the service-worker update settles):
adb -s <serial> shell am start -n io.github.avithegod2010.chatlauncher/.MainActivity
sleep 15
adb -s <serial> shell am force-stop io.github.avithegod2010.chatlauncher
adb -s <serial> shell am start -n io.github.avithegod2010.chatlauncher/.MainActivity

# 4. Restore DNS filtering (only if step 2 was used)
adb -s <serial> shell settings put global private_dns_mode hostname
adb -s <serial> shell settings put global private_dns_specifier ADNS-aeaeb1.dns.nextdns.io
```

## Then verify hands-on

- Launcher icon: gradient square, white bubble, **3 dots**
- Long-press the app icon: shortcuts (WhatsApp / Telegram / SMS)
- Home screen: the **Chat Launcher widget** (4×2) lists top targets and its
  chips deep-link through `chatlauncher://`
- Quick Settings shade: **Chat Launcher tile** opens the app
- Share a text containing a number from another app → lands in the launcher
- In-app: **Settings → Export data** opens the Android share sheet (v2.0.1+)
- In-app: **Settings → Scan** works even without `BarcodeDetector` (v2.0.2+)
- Settings footer shows `Chat Launcher v2.0.2`

## Notes

- The shell loads the live site, so web-only changes ship without a new APK.
  A new APK is only needed when `expo-app/` (native side) changes.
- Restored data comes from a backup JSON (Settings → Import data), validated
  field-by-field on import.
