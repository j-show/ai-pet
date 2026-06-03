use tauri::WebviewWindow;

/// Force WKWebView / NSWindow to present the latest canvas pixels when the app is not key.
#[cfg(target_os = "macos")]
pub fn invalidate_transparent_window(window: &WebviewWindow) -> Result<(), String> {
    window
        .with_webview(|webview| {
            use objc2_app_kit::NSWindow;
            use objc2_web_kit::WKWebView;

            unsafe {
                let wk_view = &*webview.inner().cast::<WKWebView>();
                let ns_window = &*webview.ns_window().cast::<NSWindow>();

                wk_view.setNeedsDisplay(true);
                if let Some(content) = ns_window.contentView() {
                    content.setNeedsDisplay(true);
                }
                ns_window.displayIfNeeded();
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn invalidate_transparent_window(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}
