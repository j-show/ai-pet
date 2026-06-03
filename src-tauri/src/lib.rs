mod deep_link_argv;
mod macos_compositor;
mod pet_store;
mod text_payload;
mod tool_reply;
mod user_env;

use std::collections::HashMap;
use tauri::{Emitter, Manager};
#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;

use pet_store::ResolvedUserPet;

#[tauri::command]
fn load_user_env(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    user_env::load_env_file(&home)
}

#[tauri::command]
fn save_user_env(
    app: tauri::AppHandle,
    values: HashMap<String, String>,
) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    user_env::merge_env_file(&home, &values)
}

#[tauri::command]
fn resolve_user_pet(app: tauri::AppHandle, pet_id: String) -> Result<Option<ResolvedUserPet>, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    pet_store::resolve_user_pet(&home, &pet_id)
}

#[tauri::command]
fn read_text_payload(
    app: tauri::AppHandle,
    sid: String,
) -> Result<Option<text_payload::TextPayload>, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    text_payload::read_text_payload(&home, &sid)
}

#[tauri::command]
fn send_tool_reply(
    app: tauri::AppHandle,
    sty: String,
    sid: String,
    text: String,
) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    tool_reply::send_tool_reply(&home, &sty, &sid, &text)
}

/// Startup / secondary-instance deep links with `cmd`-split query fragments merged.
#[tauri::command]
fn collect_deep_link_urls() -> Vec<String> {
    deep_link_argv::collect_from_process_args()
}

#[tauri::command]
fn invalidate_transparent_window(window: tauri::WebviewWindow) -> Result<(), String> {
    macos_compositor::invalidate_transparent_window(&window)
}

/// Poll whether the primary mouse button is still held (Windows native drag workaround).
#[tauri::command]
fn is_primary_mouse_button_down() -> bool {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" {
            fn GetAsyncKeyState(v_key: i32) -> i16;
        }

        const VK_LBUTTON: i32 = 0x01;
        unsafe { GetAsyncKeyState(VK_LBUTTON) & 0x8000u16 as i16 != 0 }
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls = deep_link_argv::collect_from_args(argv);
            if !urls.is_empty() {
                let _ = app.emit("deep-link://new-url", urls);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            load_user_env,
            save_user_env,
            resolve_user_pet,
            read_text_payload,
            send_tool_reply,
            collect_deep_link_urls,
            invalidate_transparent_window,
            is_primary_mouse_button_down,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                // Accessory apps avoid macOS transparent-window compositor glitches on focus loss.
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if let Some(_window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    use tauri::window::Color;
                    let _ = _window.set_background_color(Some(Color(0, 0, 0, 0)));
                    let _ = _window.set_shadow(false);
                }
            }

            #[cfg(any(windows, target_os = "linux"))]
            {
                app.deep_link().register_all()?;
            }

            if let Ok(home) = app.path().home_dir() {
                if let Ok(env) = user_env::load_env_file(&home) {
                    if user_env::protocol_debug_enabled(&env) {
                        if let Some(window) = app.get_webview_window("main") {
                            window.open_devtools();
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
