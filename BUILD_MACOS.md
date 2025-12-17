# macOS 构建说明（MacBook Air M2）

## 前置要求

在构建之前，确保你的 MacBook 上安装了以下工具：

### 1. Xcode Command Line Tools
```bash
xcode-select --install
```

### 2. Homebrew（包管理器）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 3. Node.js
```bash
brew install node
```

### 4. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 5. 添加 Apple Silicon 目标
```bash
rustup target add aarch64-apple-darwin
```

## 构建步骤

### 方法 1：使用自动脚本（推荐）

1. 将整个 `WindowPet-0.0.9` 文件夹复制到你的 MacBook
2. 打开终端，进入项目目录：
   ```bash
   cd /path/to/WindowPet-0.0.9
   ```
3. 给构建脚本添加执行权限：
   ```bash
   chmod +x build-macos.sh
   ```
4. 运行构建脚本：
   ```bash
   ./build-macos.sh
   ```

### 方法 2：手动构建

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建前端：
   ```bash
   npm run build
   ```

3. 构建 Tauri 应用（Apple Silicon）：
   ```bash
   npm run tauri build -- --target aarch64-apple-darwin
   ```

## 构建产物位置

构建完成后，你可以在以下位置找到安装包：

- **DMG 安装包**：
  ```
  src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/WindowPet_0.0.9_aarch64.dmg
  ```

- **APP 应用**：
  ```
  src-tauri/target/aarch64-apple-darwin/release/bundle/macos/WindowPet.app
  ```

## 安装应用

### 使用 DMG 安装（推荐）

1. 双击打开 `.dmg` 文件
2. 将 `WindowPet` 拖拽到 `Applications` 文件夹
3. 第一次打开时，右键点击应用，选择"打开"（绕过 Gatekeeper 安全检查）

### 直接使用 APP

1. 复制 `WindowPet.app` 到 `Applications` 文件夹
2. 第一次打开时，右键点击应用，选择"打开"

## 已修复的问题

✅ **macOS 窗口创建 Bug 已修复**
- 将 `fullscreen: true` 改为使用实际屏幕尺寸
- 添加了对高分辨率显示器（Retina）的支持
- 优化了 Apple Silicon (M2) 的兼容性

✅ **Corgi 宠物已包含**
- 图片位于 `public/media/Corgi.png`
- 应用启动后可以从宠物商店添加 Corgi

## 故障排除

### 应用无法打开（"应用已损坏"）

这是 macOS 的安全机制。解决方法：

```bash
# 移除隔离属性
xattr -cr /Applications/WindowPet.app

# 或者允许任何来源的应用（需要管理员权限）
sudo spctl --master-disable
```

### 构建失败：缺少依赖

如果构建时提示缺少某些依赖，运行：

```bash
# 清理并重新安装
rm -rf node_modules
npm install
```

### Rust 目标缺失

如果提示缺少 aarch64 目标：

```bash
rustup target add aarch64-apple-darwin
```

## 开发模式

如果你想在开发模式下运行（不构建安装包）：

```bash
npm run tauri dev
```

这会启动开发服务器，可以实时查看修改效果。

## 技术细节

- **应用类型**：桌面宠物覆盖层应用
- **框架**：Tauri 1.5.4 + React 18 + Phaser 3
- **目标架构**：aarch64-apple-darwin（Apple Silicon）
- **窗口特性**：透明、始终在顶部、点击穿透

## 使用说明

1. 应用启动后会在屏幕上显示宠物
2. 点击系统托盘图标可以：
   - Show - 显示宠物窗口
   - Pause - 暂停宠物（释放内存）
   - Setting - 打开设置窗口
   - Restart - 重启应用
   - Quit - 退出应用
3. 在设置窗口中可以添加/移除宠物，包括 Corgi
4. 宠物会在屏幕上自由活动，支持点击穿透

---

如有问题，请查看项目 GitHub：https://github.com/SeakMengs/WindowPet
