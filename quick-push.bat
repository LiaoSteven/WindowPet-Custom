@echo off
echo ========================================
echo   Quick Push to GitHub
echo ========================================
echo.

git add .
git commit -m "Fix: Disable updater to prevent build failure"
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Push Successful!
    echo ========================================
    echo.
    echo Next: Go to GitHub Actions and run the workflow again
    echo.
) else (
    echo.
    echo ========================================
    echo   Push Failed
    echo ========================================
    echo.
)

pause
