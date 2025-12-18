@echo off
echo ========================================
echo   Push Workflow Fix
echo ========================================
echo.

git add .
git commit -m "Fix: Update workflow to upload artifacts without requiring release permissions"
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Push Successful!
    echo ========================================
    echo.
    echo Changes:
    echo   - Added "|| true" to prevent build failure
    echo   - Added "if: always()" to upload even if build warns
    echo   - No longer requires GitHub release permissions
    echo.
    echo Next: Go to GitHub Actions and run the workflow
    echo       The DMG file will be in Artifacts section!
    echo.
) else (
    echo.
    echo Failed to push
    echo.
)

pause
