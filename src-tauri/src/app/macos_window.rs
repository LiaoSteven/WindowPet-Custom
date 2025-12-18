#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
use cocoa::base::id;

#[cfg(target_os = "macos")]
use tauri::Window;

/// Set macOS window to float above all other windows including fullscreen apps
#[cfg(target_os = "macos")]
pub fn set_window_above_all(window: &Window) {
    use cocoa::appkit::NSWindowLevel;

    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Set window level to floating (above all normal windows)
        // NSScreenSaverWindowLevel = 1000 (above everything except screen saver)
        ns_window.setLevel_(NSWindowLevel::NSScreenSaverWindowLevel as i64);

        // Set collection behavior to appear on all spaces and above fullscreen
        let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;

        ns_window.setCollectionBehavior_(behavior);
    }
}

#[cfg(not(target_os = "macos"))]
pub fn set_window_above_all(_window: &tauri::Window) {
    // Non-macOS platforms don't need this
}
