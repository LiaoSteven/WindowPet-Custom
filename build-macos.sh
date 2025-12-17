#!/bin/bash

# macOS Build Script for WindowPet
# This script builds the application for Apple Silicon (M2) and Intel Macs

set -e

echo "==================================="
echo "WindowPet macOS Build Script"
echo "==================================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Error: This script must be run on macOS"
    exit 1
fi

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "Rust is not installed. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo ""
echo "Step 1: Installing dependencies..."
npm install

echo ""
echo "Step 2: Building frontend..."
npm run build

echo ""
echo "Step 3: Building Tauri application for Apple Silicon (aarch64)..."
npm run tauri build -- --target aarch64-apple-darwin

echo ""
echo "==================================="
echo "Build completed successfully!"
echo "==================================="
echo ""
echo "Your application can be found at:"
echo "  DMG: src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/WindowPet_*.dmg"
echo "  APP: src-tauri/target/aarch64-apple-darwin/release/bundle/macos/WindowPet.app"
echo ""
echo "To install:"
echo "  1. Open the .dmg file"
echo "  2. Drag WindowPet to your Applications folder"
echo "  3. Right-click the app and select 'Open' (first time only, due to Gatekeeper)"
echo ""
