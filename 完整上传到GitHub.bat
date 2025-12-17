@echo off
chcp 65001 >nul
echo ========================================
echo   完整上传项目到 GitHub
echo ========================================
echo.

REM 检查是否有 git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未安装 Git
    echo.
    echo 请先安装 Git：
    echo 1. 访问 https://git-scm.com/download/win
    echo 2. 下载并安装
    echo 3. 重新运行此脚本
    echo.
    pause
    exit /b 1
)

echo 📋 请提供你的 GitHub 仓库信息
echo.
echo 示例：
echo   用户名: zhangsan
echo   仓库名: WindowPet-Custom
echo.

set /p USERNAME="你的 GitHub 用户名: "
set /p REPONAME="你的仓库名: "

set REPO_URL=https://github.com/%USERNAME%/%REPONAME%.git

echo.
echo ========================================
echo 将推送到：%REPO_URL%
echo ========================================
echo.
echo 确认无误请按任意键继续...
pause >nul

echo.
echo [1/6] 清理旧的 git 配置（如果有）...
if exist ".git" (
    rmdir /s /q .git
    echo ✓ 已清理
) else (
    echo ✓ 无需清理
)
echo.

echo [2/6] 初始化 Git 仓库...
git init
git branch -M main
echo ✓ 完成
echo.

echo [3/6] 添加远程仓库...
git remote add origin %REPO_URL%
echo ✓ 完成
echo.

echo [4/6] 添加所有文件...
git add .
echo ✓ 完成
echo.

echo [5/6] 创建提交...
git commit -m "完整上传：修复 macOS M2 bug，包含所有源代码"
echo ✓ 完成
echo.

echo [6/6] 强制推送到 GitHub（会覆盖远程仓库）...
echo.
echo ⚠️  警告：这将覆盖 GitHub 上的现有内容
echo    如果 GitHub 上有重要内容，请先备份
echo.
echo 按任意键继续推送，或关闭窗口取消...
pause >nul

git push -f origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo          ✅ 上传成功！
    echo ========================================
    echo.
    echo 📁 已上传的关键文件：
    echo    ✓ src/ 文件夹（前端源代码）
    echo    ✓ src-tauri/ 文件夹（后端代码）
    echo    ✓ public/ 文件夹（包括 Corgi.png）
    echo    ✓ .github/workflows/ （GitHub Actions 配置）
    echo    ✓ package.json 和其他配置文件
    echo.
    echo 📋 下一步：
    echo    1. 打开浏览器访问：
    echo       %REPO_URL:.git=%
    echo.
    echo    2. 点击 "Actions" 标签
    echo.
    echo    3. 左侧点击 "手动构建 macOS 版本"
    echo.
    echo    4. 右侧点击 "Run workflow"
    echo       选择 "macos-m2" 然后运行
    echo.
    echo    5. 等待 15-20 分钟构建完成
    echo.
    echo    6. 下载构建产物（DMG 安装包）
    echo.
) else (
    echo.
    echo ========================================
    echo          ❌ 上传失败
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. GitHub 用户名或仓库名错误
    echo 2. 没有权限（需要登录）
    echo 3. 网络连接问题
    echo.
    echo 💡 首次推送会弹出登录窗口
    echo    使用你的 GitHub 账号登录即可
    echo.
    echo 💡 如果一直失败，可以：
    echo    1. 删除 GitHub 上的旧仓库
    echo    2. 重新创建一个新仓库
    echo    3. 重新运行此脚本
    echo.
)

echo.
pause
