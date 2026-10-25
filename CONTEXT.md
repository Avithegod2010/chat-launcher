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
| **Share target** | Manifest feature letting the installed PWA appear in the Android share sheet; shared text is received as `?text=` and mined for a phone number. |

## Product rules of thumb

- Everything is client-side. No backend, no accounts, no analytics, no network after first load.
- Any data the app keeps (history, settings, country) lives in `localStorage` under the `chatlauncher:` prefix and never leaves the device.
- Honesty over flash: platforms that cannot open a chat by number are labeled `limited` in the UI, README, and capability matrix — never silently faked.
