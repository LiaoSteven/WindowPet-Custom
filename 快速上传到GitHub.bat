@echo off
chcp 65001 >nul
echo ========================================
echo     WindowPet GitHub 快速上传工具
echo ========================================
echo.

REM 检查是否已经初始化 git
if not exist ".git" (
    echo [1/4] 初始化 Git 仓库...
    git init
    git branch -M main
    echo.
) else (
    echo [√] Git 仓库已存在
    echo.
)

REM 询问 GitHub 仓库地址
if not exist ".git\config" (
    echo 请输入你的 GitHub 仓库地址
    echo 格式示例: https://github.com/你的用户名/WindowPet-Custom.git
    echo.
    set /p REPO_URL="仓库地址: "

    echo.
    echo [2/4] 添加远程仓库...
    git remote add origin %REPO_URL%
    echo.
) else (
    echo [√] 远程仓库已配置
    echo.
)

echo [3/4] 添加所有文件...
git add .
echo.

echo [4/4] 提交并推送到 GitHub...
git commit -m "Update: macOS M2 bug fix and new Corgi image"
git push -u origin main

echo.
echo ========================================
echo          上传完成！
echo ========================================
echo.
echo 下一步：
echo 1. 打开你的 GitHub 仓库页面
echo 2. 点击顶部的 "Actions" 标签
echo 3. 选择 "手动构建 macOS 版本"
echo 4. 点击 "Run workflow" 按钮
echo 5. 选择 "macos-m2"，然后点击运行
echo.
pause
