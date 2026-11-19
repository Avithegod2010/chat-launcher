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

> Note: this scaffold was never compiled locally — the build machine used for
> the web/Android work has no Rust toolchain. It is built by
> `.github/workflows/desktop.yml` on a Windows runner instead: run that
> workflow (or push to `desktop/**`) and download the artifact — a portable
> `chat-launcher-desktop.exe`, an NSIS installer, and `SHA256SUMS.txt`.

> Updater: `tauri-plugin-updater` is live. Builds are signed with the
> `TAURI_SIGNING_PRIVATE_KEY` secret; the app checks the
> `desktop-latest` release feed (`latest.json`) about eight seconds after
> launch, verifies the minisign signature against the pubkey in
> `tauri.conf.json` and installs the NSIS package. `desktop.yml` publishes
> that feed from `main` and from `desktop-v*` tags — never from feature
> branches. Tray → **Check for updates…** runs the same check on demand and
> reports through a native dialog.
>
> The private key and its password live in the repository secrets and in
> `dist/desktop-updater/` locally (gitignored). Losing them means existing
> installs can no longer verify updates and users must reinstall by hand.

## Why not Electron?

Electron ships a whole Chromium (~150 MB); Tauri uses the OS webview, so the
shell stays around 2 MB and the PWA does all the work.

## Hotkey

`Ctrl+Shift+C` — registered through `tauri-plugin-global-shortcut`
(see `src/main.rs`). Edit the `Shortcut` line to change it.
