# Chat Launcher — browser extension (MV3)

Select or right-click any phone number on any page and open its chat in
WhatsApp, Telegram, Signal and more — powered by the
[Chat Launcher](https://avithegod2010.github.io/chat-launcher/) PWA.

## Features

- **Selection pill** — select text that contains a phone number and a
  "💬 Open chat" pill floats next to it
- **Right-click menu** — "Open in Chat Launcher" on any selection or link
- **Toolbar button** — opens Chat Launcher directly
- **Self-host** — the options page lets you point the extension at your own
  deployment or custom domain (https only)

## Load locally (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → pick this `extension/` folder

Firefox: the same folder works as a temporary add-on via
`about:debugging#/runtime/this-firefox` (MV3 event pages are supported).

## Packaging

```
node tools/pack-extension.mjs   # zips extension/ → dist/chat-launcher-extension.zip
```

Not published to the Chrome Web Store yet — see the roadmap in the main README.
