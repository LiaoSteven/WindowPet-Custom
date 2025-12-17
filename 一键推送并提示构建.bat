@echo off
chcp 65001 >nul
echo ========================================
echo   WindowPet 一键推送到 GitHub
echo ========================================
echo.

REM 检查是否有 git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未安装 Git
    echo.
    echo 请先安装 Git：https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM 检查是否是 git 仓库
if not exist ".git" (
    echo [1/5] 初始化 Git 仓库...
    git init
    git branch -M main
    echo.

    echo 请输入你的 GitHub 仓库地址
    echo 格式：https://github.com/你的用户名/WindowPet-Custom.git
    echo.
    set /p REPO_URL="仓库地址: "

    echo.
    echo [2/5] 添加远程仓库...
    git remote add origin %REPO_URL%
    echo.
) else (
    echo [√] Git 仓库已存在
    echo.
)

echo [3/5] 添加所有文件...
git add .
echo.

echo [4/5] 提交更改...
set /p COMMIT_MSG="输入提交信息（直接回车使用默认）: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=更新代码：修复 macOS M2 bug 和更新 Corgi 图片

git commit -m "%COMMIT_MSG%"
echo.

echo [5/5] 推送到 GitHub...
git push -u origin main
echo.

if %errorlevel% equ 0 (
    echo ========================================
    echo          ✅ 推送成功！
    echo ========================================
    echo.
    echo 📋 下一步操作：
    echo.
    echo 1. 打开浏览器，访问你的 GitHub 仓库
    echo 2. 点击顶部的 "Actions" 标签
    echo 3. 左侧点击 "手动构建 macOS 版本"
    echo 4. 右侧点击 "Run workflow" 按钮
    echo 5. 选择 "macos-m2"
    echo 6. 点击绿色 "Run workflow" 按钮开始构建
    echo.
    echo 🌐 或者直接访问这个链接：
    for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
    set REPO_URL=%REPO_URL:.git=%
    echo %REPO_URL%/actions
    echo.
    echo 💡 提示：按 Ctrl+C 可复制链接
    echo.
) else (
    echo ========================================
    echo          ❌ 推送失败
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. 仓库地址不正确
    echo 2. 没有权限（需要登录 GitHub）
    echo 3. 网络连接问题
    echo.
    echo 💡 首次推送可能需要登录 GitHub
    echo    浏览器会自动打开，按提示登录即可
    echo.
)

pause
