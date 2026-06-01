mod macos_compositor;
mod pet_store;
mod user_env;

use std::collections::HashMap;
use tauri::Manager;
#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;

use pet_store::ResolvedUserPet;

#[tauri::command]
fn load_user_env(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    user_env::load_env_file(&home)
}

#[tauri::command]
fn resolve_user_pet(app: tauri::AppHandle, pet_id: String) -> Result<Option<ResolvedUserPet>, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    pet_store::resolve_user_pet(&home, &pet_id)
}

#[tauri::command]
fn invalidate_transparent_window(window: tauri::WebviewWindow) -> Result<(), String> {
    macos_compositor::invalidate_transparent_window(&window)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            load_user_env,
            resolve_user_pet,
            invalidate_transparent_window,
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
