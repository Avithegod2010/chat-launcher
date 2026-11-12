# Chat Launcher — Domain Context

A tiny glossary of the vocabulary used across this repo. New contributors
should read this first so discussions use the same words.

| Term | Meaning |
|---|---|
| **E.164** | The ITU international phone number format: country code + subscriber number, digits only, no leading zero, max 15 digits (e.g. `919876543210`). All launch targets are built from an E.164 number. |
| **Dial code** | The country calling prefix (e.g. `91` for India, `1` for the US/Canada NANP zone). Stored without a `+`. |
| **National number** | The subscriber number as written inside the country, possibly with a trunk `0` (e.g. `020 7946 0958` in the UK). |
| **Trunk zero** | Leading `0` dialed domestically. Dropped for E.164 in almost all countries; Italy is the classic exception and keeps it. |
| **Launch target** | One of the messenger/telephony apps you can open a number with (WhatsApp, Telegram, Signal, SMS, Call, Viber, Skype, LINE, Threema). |
| **Deep link** | The URL that opens a specific chat: `https://wa.me/919876543210`, `tel:+…`, `sms:+……?body=…`, etc. |
| **Capability: `full` / `limited`** | `full` = the deep link can address a specific phone number. `limited` = the platform has no open-by-number URL, so we can only open the app itself (LINE, Threema). Marked with an "app only" badge in the UI. |
| **Preset message** | Optional pre-filled text handed to the target via `?text=` / `?body=` where the platform supports it. |
| **Precache** | The service worker strategy: the entire app shell is cached on install, so the app works fully offline and loads instantly. |
| **Expo shell** | The Android app in `expo-app/`: a minimal React Native WebView container (built on EAS) that hosts the live PWA and forwards external links to the OS. It holds no UI or data of its own. |
| **Shell bridge** | The two-way `postMessage` channel between the PWA and the Expo/Tauri shell: the page posts its top history entries (→ dynamic launcher shortcuts), the shell posts contact-picked numbers (→ phone input). Guarded by the presence of `window.ReactNativeWebView`. |
| **Quick action** | A home-screen long-press shortcut. Static ones are defined at build time; dynamic ones are set at runtime from the user's most-used history entries. |
| **Backup** | A JSON file (`chat-launcher-backup`, versioned) containing settings, history and stats, produced locally and validated field-by-field on import. |
| **Offline queue** | Numbers shared into the app while offline (`chatlauncher:pending`, max 5). A toast offers a one-tap launch when connectivity returns. |
| **Bundle budget** | The CI guard on how many kilobytes the precached app shell may weigh (currently well under 400 KB uncompressed). |
| **Reproducibility job** | A manual workflow that builds the same commit twice on EAS and compares APK hashes. Informational only — signed APKs are not byte-identical by nature. |
| **Share target** | Manifest feature letting the installed PWA appear in the Android share sheet; shared text is received as `?text=` and mined for a phone number. |
| **Share-in (shell)** | The native side of the same idea: the Expo shell registers for `ACTION_SEND` (`expo-share-intent`), and any text shared into the app lands in the page via the shell bridge (`chatlauncher-share`), where the first phone number is extracted. |
| **Template** | A reusable message stored under `chatlauncher:templates`. `expandTemplate` substitutes `{name} {number} {app} {date} {time}` at launch time; unknown `{placeholders}` are left untouched. |
| **Broadcast list** | A named group of numbers (`chatlauncher:lists`, max 20 lists × 200 members) launched one-by-one on a chosen target; imports/exports RFC-4180-style CSV. |
| **Suggestion** | The `js/suggest.js` score that highlights the tile you'd most likely use for the typed number: per-entry default ≫ last-used app ≫ global usage ≈ time-of-day bucket (`stats.byHour`). Display-only — it never overrides an explicit choice. |
| **Sync envelope** | `chat-launcher-sync` v1: `{salt, iv, ct}` base64 AES-GCM blob. Key = PBKDF2-SHA256(passphrase, 310k). Transport is the user's own WebDAV endpoint (https enforced, plain http only for localhost). |
| **Sync merge** | `mergeRemote` unions remote-only history/templates/lists and keeps the locally newer copy when both sides have an entry (compares `lastUsed`). |
| **Scanner** | In-app camera scan via the Web `BarcodeDetector` API (no native dependency): parses QR/MeCard/barcodes for `tel:`, `wa.me`, `?number=` URLs, vCard `TEL` lines or bare numbers. |
| **Palette** | The `Ctrl/⌘+K` command palette: one fuzzy-filtered list built from launch targets, actions, history, templates, lists and languages. All rendering is text-only (injection-safe). |
| **Home widget** | The Android 4×2 AppWidget (`react-native-android-widget`): mirrors the top 3 history entries; taps deep-link into the site. Data flows page → shell → AsyncStorage → headless widget task handler. |
| **QS tile** | The Quick Settings tile service (`LauncherTileService.kt`, injected by `expo-app/plugins/tile-plugin.js`): one tap opens Chat Launcher. |
| **Clipboard watcher** | Desktop-only (`desktop/src-tauri`): polls the clipboard; a fresh 8–15-digit "number only" text summons the window pre-filled. |
| **Motion tokens** | CSS custom properties (`--m-fast/med/slow`, `--ease-out/spring`) that every animation derives from — retune (or flatten under `prefers-reduced-motion`) in one place. |

## Product rules of thumb

- Everything is client-side. No backend, no accounts, no analytics, no network after first load — *except* the opt-in encrypted sync, which talks only to the server the user configured.
- Any data the app keeps (history, settings, country) lives in `localStorage` under the `chatlauncher:` prefix and never leaves the device (sync uploads are ciphertext only).
- Honesty over flash: platforms that cannot open a chat by number are labeled `limited` in the UI, README, and capability matrix — never silently faked.
