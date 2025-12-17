@echo off
echo ========================================
echo   Upload WindowPet to GitHub
echo ========================================
echo.

REM Check if git is installed
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed
    echo.
    echo Please install Git from: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo Please provide your GitHub repository information
echo.
echo Example:
echo   Username: zhangsan
echo   Repository: WindowPet-Custom
echo.

set /p USERNAME="Your GitHub username: "
set /p REPONAME="Your repository name: "

set REPO_URL=https://github.com/%USERNAME%/%REPONAME%.git

echo.
echo ========================================
echo Will push to: %REPO_URL%
echo ========================================
echo.
echo Press any key to continue...
pause >nul

echo.
echo [1/6] Cleaning old git config...
if exist ".git" (
    rmdir /s /q .git
    echo Done
) else (
    echo No need to clean
)
echo.

echo [2/6] Initializing Git repository...
git init
git branch -M main
echo Done
echo.

echo [3/6] Adding remote repository...
git remote add origin %REPO_URL%
echo Done
echo.

echo [4/6] Adding all files...
git add .
echo Done
echo.

echo [5/6] Creating commit...
git commit -m "Complete upload: Fixed macOS M2 bug with all source code"
echo Done
echo.

echo [6/6] Force pushing to GitHub...
echo.
echo WARNING: This will overwrite existing content on GitHub
echo Press any key to continue or close window to cancel...
pause >nul

git push -f origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo          Upload Successful!
    echo ========================================
    echo.
    echo Key files uploaded:
    echo    [OK] src/ folder
    echo    [OK] src-tauri/ folder
    echo    [OK] public/ folder with Corgi.png
    echo    [OK] .github/workflows/
    echo    [OK] package.json and configs
    echo.
    echo Next steps:
    echo    1. Open browser and visit:
    echo       %REPO_URL:.git=%
    echo.
    echo    2. Click "Actions" tab
    echo.
    echo    3. Click "Manual build macOS version" on left
    echo.
    echo    4. Click "Run workflow" on right
    echo       Select "macos-m2" and run
    echo.
    echo    5. Wait 15-20 minutes for build
    echo.
    echo    6. Download the DMG installer
    echo.
) else (
    echo.
    echo ========================================
    echo          Upload Failed
    echo ========================================
    echo.
    echo Possible reasons:
    echo 1. Wrong username or repository name
    echo 2. No permission - need to login
    echo 3. Network connection issue
    echo.
    echo TIP: First push may ask for GitHub login
    echo      Browser will open for authentication
    echo.
)

echo.
pause
