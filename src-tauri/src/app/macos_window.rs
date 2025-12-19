#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior, NSBackingStoreType};
#[cfg(target_os = "macos")]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

#[cfg(target_os = "macos")]
use tauri::Window;

/// Set macOS window transparency and behavior for desktop pet overlay
#[cfg(target_os = "macos")]
pub fn set_window_above_all(window: &Window) {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Don't set custom window level - let Tauri's alwaysOnTop handle it
        // This prevents blocking other applications

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

        // Set collection behavior to appear on all spaces
        // Avoid Stationary to allow normal window behavior
        let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces;

        ns_window.setCollectionBehavior_(behavior);

        // Ensure window can receive events for mouse detection
        ns_window.setAcceptsMouseMovedEvents_(YES);
    }
}

#[cfg(not(target_os = "macos"))]
pub fn set_window_above_all(_window: &tauri::Window) {
    // Non-macOS platforms don't need this
}
