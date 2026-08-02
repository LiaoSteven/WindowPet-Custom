#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use tauri::Window;

/// Configure the desktop-pet window for macOS Spaces and fullscreen apps.
///
/// `always_on_top` only controls the window's z-level. The collection behavior
/// is a separate macOS setting that determines whether the window follows the
/// user between Spaces and fullscreen Spaces.
#[cfg(target_os = "macos")]
pub fn configure_window(window: &Window) {
    unsafe {
        let Some(ns_window) = window.ns_window() else {
            return;
        };
        let ns_window = ns_window as id;

        let behavior = ns_window.collectionBehavior()
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;

        ns_window.setCollectionBehavior_(behavior);
    }
}

#[cfg(not(target_os = "macos"))]
pub fn configure_window(_window: &tauri::Window) {}
