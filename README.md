# 💬 Chat Launcher

**Type a phone number → tap an app → start chatting.**

Chat Launcher opens a number's chat directly in WhatsApp, Telegram, Signal, SMS, Viber, Skype and more — no contacts app, no copy-pasting, no saving the number first. It's a zero-dependency, offline-first PWA: nothing is tracked, nothing leaves your device, and it installs as a real app on Android, iOS and desktop.

<p align="center">
  <img src="screenshots/desktop-dark.png" alt="Chat Launcher on desktop (dark theme)" width="720">
</p>
<p align="center">
  <img src="screenshots/mobile-dark.png" alt="Chat Launcher on mobile" width="300">
</p>

## Why

Every messenger hides chat-by-number behind the same dance: save the contact, reopen the app, find them, chat — for a one-time conversation with a plumber or a marketplace seller. Chat Launcher collapses that to *number in, chat open*. It also shines when you already have a number in front of you (a listing, a support page, a message): paste `+91 98765 43210` and the country is detected automatically.

## Features

- 🚀 **9 launch targets** — WhatsApp, Telegram, Signal, SMS, Phone call, Viber, Skype, LINE, Threema
- 🌍 **Country picker** with ~230 dial codes and emoji flags; your choice is remembered
- 🧠 **Smart paste** — `+44 20 7946 0958`, `0049…`, `+1 (555) …` are parsed and matched to the country by longest prefix
- 🎯 **Per-country validation** — live feedback against each country's real numbering-plan lengths (India = 10 digits, Singapore = 8, …), not just a generic 7–15 rule
- ✍️ **Preset message** — pre-fill text where the platform supports it (WhatsApp, SMS)
- 🕘 **History** — recent numbers with usage counts, pin favourites, rename, and free-text notes ("plumber — quoted 2k")
- 📷 **QR share** — scannable code for the current number, so desktop → phone handoff is one scan
- 🧨 **Bulk launch** — paste a list of numbers, open them one by one or all at once (great for marketplace sellers)
- 💬 **Open in the native app** — on desktop, right-click the WhatsApp/Telegram tile to launch the installed client instead of the web
- ⌨️ **Dial-pad mode** for one-handed touch input
- ⌨️ **Keyboard shortcuts** — `Enter` launch, `Ctrl+1–9` app picker, `/` focus, `d` dial pad, `t` theme, `?` help
- 🌗 **Dark / light / system theme** with animated transitions, plus 4 accent presets
- 🌐 **English + हिन्दी** interface (auto-detected, switchable in settings)
- 📊 **Local-only usage dashboard** — chats launched all-time and this month, top apps — computed entirely on-device
- 📲 **Installable PWA** — service-worker precache, offline from second visit, update toast, share-target support (share a number from any app into Chat Launcher)
- 🔗 **Deep links** — `?number=+15551234567&text=hi&app=whatsapp` opens pre-filled
- ♿ **Accessible** — keyboard navigable, aria-live validation, `prefers-reduced-motion` honoured
- 🤖 **CI on every push** — 55 unit tests + 9 adversarial security probes + asset checks; tags build the Android APK on EAS and attach it to the release automatically

## Platform support

| Target | Opens chat by number | Pre-filled message | Deep link |
|---|---|---|---|
| WhatsApp | ✅ | ✅ | `https://wa.me/<number>?text=…` |
| Telegram | ✅ | — | `https://t.me/+<number>` |
| Signal | ✅ | — | `https://signal.me/#p/+<number>` |
| SMS | ✅ | ✅ | `sms:+<number>?body=…` (iOS: `&body=`) |
| Phone call | ✅ | — | `tel:+<number>` |
| Viber | ✅ | — | `viber://chat?number=%2B…` |
| Skype | ✅ | — | `skype:+<number>?chat` |
| LINE | ⚠️ app only | — | `line://` |
| Threema | ⚠️ app only | — | `threema://` |

*App only* = the platform exposes no open-chat-by-phone-number URL, so the tile opens the app itself. This is a platform limitation, not a bug — it's labeled honestly in the UI too.

## Privacy

- **No network requests after load.** The app is a static shell; the only outbound navigation is the deep link you tap.
- **No accounts, no analytics, no tracking** — enforced by the Content-Security-Policy (`connect-src 'none'`).
- **All data stays on your device** in `localStorage` (history, settings). "Wipe all local data" in settings removes everything.
- Referrer is stripped (`no-referrer`) so chat targets don't learn you came from Chat Launcher.

## Install as an app

- **Android (Chrome/Edge):** open the site → menu ⋮ → *Add to Home screen* / *Install app*
- **iOS (Safari):** Share → *Add to Home Screen*
- **Desktop (Chrome/Edge):** install icon in the address bar, or the in-app *Install* button
- **Android APK:** a small Expo shell around this site is built on [Expo EAS](https://expo.dev) and attached to [Releases](../../releases) — it loads the live app, keeps everything up to date, and hands deep links (`wa.me`, `tel:`, …) to the operating system

## Run locally

```bash
node tools/serve.mjs        # → http://127.0.0.1:8143
```

Requires only Node.js (any recent version). No build step, no dependencies.

## Tests

```bash
npm test                    # node --test tests/
node tools/serve.mjs &      # then, optionally:
node tools/bug-hunt.mjs     # adversarial probes against a real browser
```

55 unit tests cover phone-number normalization (E.164, trunk zeros, paste parsing, per-country lengths), every platform's deep-link shape, exactly-once message encoding, history behaviour (dedup, pinning, notes, capacity, corrupt-JSON recovery), stats aggregation, and i18n completeness. 9 adversarial probes drive the real app headless with hostile inputs (XSS payloads, poisoned localStorage, CSP violations).

## Tech notes

- **Zero dependencies, zero build** — vanilla ES modules; icons are generated PNGs/SVG committed to the repo (`node tools/gen-icons.mjs` regenerates them)
- **CSP-hardened** — `script-src 'self'`, `connect-src 'none'`, `form-action 'none'`
- **60 fps animations** — transforms/opacity only; drifting gradient orbs, staggered tiles, ripple ink, particle burst
- Numbers are normalized to [E.164](https://www.itu.int/rec/T-REC-E.164) before link construction; see [CONTEXT.md](CONTEXT.md) for the domain vocabulary
- **Android shell** (`expo-app/`) is a minimal React Native WebView container built with EAS — it contributes no UI of its own

## Acknowledgments

- Brand glyphs (WhatsApp, Telegram, Signal, Viber, LINE, Threema) come from [Simple Icons](https://simpleicons.org) (CC0 path data). All marks are trademarks of their respective owners — Chat Launcher is not affiliated with any of them. Skype's brand was retired in 2025, so it keeps a generic glyph.
- Country calling codes compiled from the ITU E.164 allocation list

## License

[MIT](LICENSE)
