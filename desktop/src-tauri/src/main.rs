//! Chat Launcher desktop shell.
//!
//! A small always-available window pointed at the live PWA:
//!  - global hotkey (Ctrl+Shift+C) summons the window from anywhere
//!  - tray icon with Show / Quit
//!  - clipboard watcher: copy a phone number anywhere and the launcher
//!    opens with it pre-filled (desktop equivalent of share-in)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const SITE: &str = "https://avithegod2010.github.io/chat-launcher/";

fn summon(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// True when text is (almost) only a phone number: 8–15 digits + separators.
fn is_phone_like(text: &str) -> bool {
    let t = text.trim();
    if t.len() < 8 || t.len() > 20 {
        return false;
    }
    let digits = t.chars().filter(|c| c.is_ascii_digit()).count();
    digits >= 8 && t.chars().all(|c| c.is_ascii_digit() || "+()-. \t".contains(c))
}

/// Poll the clipboard; a fresh phone number summons the launcher pre-filled.
fn start_clipboard_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Ok(mut clipboard) = arboard::Clipboard::new() else {
            return;
        };
        let mut last = String::new();
        loop {
            std::thread::sleep(Duration::from_millis(1200));
            let text = clipboard.get_text().unwrap_or_default();
            if text.is_empty() || text == last {
                continue;
            }
            last = text.clone();
            if !is_phone_like(&text) {
                continue;
            }
            let number = text.trim().replace([' ', '\t'], "");
            let url = format!("{SITE}?number={}", urlencode(&number));
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                let _ = window.eval(&format!(
                    "window.location.href = {}",
                    serde_json::to_string(&url).unwrap_or_default()
                ));
            }
        }
    });
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn main() {
    let summon_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyC);

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut(summon_shortcut, move |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        summon(app);
                    }
                })?;

            // Tray: left click summons, right click offers Show / Quit.
            let show = MenuItem::with_id(app, "show", "Show Chat Launcher", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::with_id("chatlauncher-tray")
                .icon(app.default_window_icon().expect("window icon").clone())
                .tooltip("Chat Launcher")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => summon(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        summon(tray.app_handle());
                    }
                })
                .build(app)?;

            start_clipboard_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Chat Launcher desktop");
}
