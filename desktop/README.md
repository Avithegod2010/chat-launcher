# Chat Launcher — desktop shell (Tauri)

A ~2 MB desktop window around the live PWA, with a global hotkey
(**Ctrl+Shift+C**) that summons the launcher from any app — the desktop
equivalent of long-pressing the phone icon.

The window loads `https://avithegod2010.github.io/chat-launcher/` directly,
so it always runs the latest web app (same model as the Android shell).

## Build

Requires the Rust toolchain (https://rustup.rs) plus the platform webview
deps (Windows: WebView2, usually preinstalled).

```bash
npm install -g @tauri-apps/cli   # or: cargo install tauri-cli
cd desktop/src-tauri
cargo tauri dev                  # run
cargo tauri build                # bundle (nsis/dmg/appimage)
```

> Note: this scaffold has not been compiled in this repository's CI — the
> build machine used for the web/Android work had no Rust toolchain. The
> config targets Tauri v2; `tauri.conf.json` pins the remote URL and a
> capability file allows it to talk to the network.

> Updater: `tauri-plugin-updater` is registered but dormant. The minimal
> `plugins.updater` section in `tauri.conf.json` (empty `pubkey`, no
> endpoints) is required for the plugin to initialize at startup. Fill in a
> real `pubkey` + `endpoints` when desktop auto-update is actually shipped.

## Why not Electron?

Electron ships a whole Chromium (~150 MB); Tauri uses the OS webview, so the
shell stays around 2 MB and the PWA does all the work.

## Hotkey

`Ctrl+Shift+C` — registered through `tauri-plugin-global-shortcut`
(see `src/main.rs`). Edit the `Shortcut` line to change it.
