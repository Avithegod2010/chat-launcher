//! Chat Launcher desktop shell.
//!
//! A minimal Tauri window pointed at the live PWA, plus a global hotkey
//! (Ctrl+Shift+C) that summons the window from anywhere — the desktop
//! equivalent of long-pressing the phone icon.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn main() {
    let summon = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyC);

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut(summon, move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Chat Launcher desktop");
}
