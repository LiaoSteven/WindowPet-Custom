#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior, NSBackingStoreType};
#[cfg(target_os = "macos")]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

#[cfg(target_os = "macos")]
use tauri::Window;

/// Set macOS window to float above all other windows including fullscreen apps
#[cfg(target_os = "macos")]
pub fn set_window_above_all(window: &Window) {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Set window level to maximum (above fullscreen apps)
        // Using CGWindowLevelForKey(kCGMaximumWindowLevelKey) equivalent
        // This is higher than NSScreenSaverWindowLevel and will show above fullscreen
        ns_window.setLevel_(2147483631_i64);

        // Fix for ghosting/trailing artifacts on macOS
        // Enable transparency and proper compositing
        use cocoa::base::{NO, YES};
        ns_window.setOpaque_(NO); // false
        ns_window.setHasShadow_(NO); // false - disable shadow to prevent artifacts
        ns_window.setBackgroundColor_(cocoa::base::nil);

        // Force window to use buffered backing store for proper refresh
        let _: () = msg_send![ns_window, setBackingType: NSBackingStoreType::NSBackingStoreBuffered];

        // Invalidate shadow to force redraw
        let _: () = msg_send![ns_window, invalidateShadow];

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
