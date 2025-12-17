use super::conf::AppConfig;
use log::info;
use tauri::{Manager, WindowBuilder, WindowUrl, PhysicalPosition, PhysicalSize};

#[tauri::command]
pub async fn reopen_main_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if a window with label "main" already exists
    if let Some(window) = app.get_window("main") {
        // Bring the existing window to focus
        window.set_focus().map_err(|e| e.to_string())?;
        info!("Main window already exists, brought to focus");
        return Ok(());
    }

    // If no window exists, create a new one
    // Get primary monitor size for proper fullscreen coverage
    let primary_monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;

    let monitor_size = primary_monitor.size();
    let monitor_position = primary_monitor.position();

    info!("Creating main window with size: {}x{} at position: ({}, {})",
          monitor_size.width, monitor_size.height, monitor_position.x, monitor_position.y);

    let window = WindowBuilder::new(&app, "main", WindowUrl::App("/".into()))
        .inner_size(monitor_size.width as f64, monitor_size.height as f64)
        .position(monitor_position.x as f64, monitor_position.y as f64)
        .resizable(false)
        .transparent(true)
        .always_on_top(true)
        .title("WindowPet")
        .skip_taskbar(true)
        .decorations(false)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    // Allow click-through window
    window.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    info!("Reopened main window");

    Ok(())
}

pub fn open_setting_window(app: tauri::AppHandle) {
    let settings = AppConfig::new();
    let _window = tauri::WindowBuilder::new(&app, "setting", WindowUrl::App("/setting".into()))
        .title("WindowPet Setting")
        .inner_size(1000.0, 650.0)
        .theme(if settings.get_theme() == "dark" {
            Some(tauri::Theme::Dark)
        } else {
            Some(tauri::Theme::Light)
        })
        .build()
        .unwrap_or_else(|e| {
            log::error!("Failed to create setting window: {}", e);
            panic!("Window creation failed: {}", e);
        });
    info!("open setting window");
}