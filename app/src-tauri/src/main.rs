// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::Write;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::menu::MenuItem;
use tauri::tray::MouseButton;
use tauri::tray::MouseButtonState;
use tauri::tray::TrayIconBuilder;
use tauri::tray::TrayIconEvent;
use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;

fn get_binary_name() -> &'static str {
    let mut map = HashMap::new();
    // map.insert(("windows", "x86_64"), "");
    map.insert(
        ("linux", "x86_64"),
        "remotemic-node-x86_64-unknown-linux-gnu",
    );

    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        panic!("unsupported os")
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        panic!("unsupported arch")
    };

    map.get(&(os, arch))
        .unwrap_or_else(|| panic!("binary not found for {os}-{arch}"))
}

#[derive(Clone)]
pub struct SidecarHandle {
    stdin: Arc<Mutex<std::process::ChildStdin>>,
}

fn spawn_sidecar(app: tauri::AppHandle) -> SidecarHandle {
    let mut child = Command::new("binaries/".to_owned() + get_binary_name())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .spawn()
        .expect("Failed to spawn sidecar process");

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_stdout.emit("sidecar-stdout", line);
            }
        }
    });

    let app_stderr = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_stderr.emit("sidecar-stderr", line);
            }
        }
    });

    let stdin = Arc::new(Mutex::new(child.stdin.take().unwrap()));

    std::thread::spawn({
        let mut child = child;
        move || {
            let status = child.wait();
            println!("Sidecar exited: {:?}", status);
        }
    });

    SidecarHandle { stdin }
}

#[tauri::command]
fn send_to_sidecar(handle: tauri::State<SidecarHandle>, input: String) {
    let mut stdin = handle.stdin.lock().unwrap();
    writeln!(stdin, "{}", input).unwrap();
}

fn main() {
    // fix the shitass scrolling behavior on linux its actually so bad omg WHY IS THIS NOT THE DEFAULT
    // std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    // std::env::remove_var("GDK_BACKEND");
    // std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![send_to_sidecar])
        .setup(|app| {
            let handle = spawn_sidecar(app.app_handle().clone());
            app.manage(handle);
            Ok(())
        })
        .setup(|app| {
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&open_item, &quit_item])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => std::process::exit(0),
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }

                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        println!("tray icon click");
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }

                    _ => {}
                })
                .build(app)?;

            // let window = app.get_webview_window("main").unwrap();
            // let _ = window.hide();
            Ok(())
        })
        .on_window_event(|app, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = app.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
