@echo off
REM Bhagavad Gita App - Native Build Setup Script (Windows)
REM This script sets up everything needed to build native Android apps on Windows

echo 🕉️  Bhagavad Gita App - Native Build Setup
echo ============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed.
    echo 📥 Please install Node.js from: https://nodejs.org/
    echo    Download version 16 or higher
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version
echo ✅ npm version:
npm --version
echo.

REM Ask which platform
echo Which platform do you want to build for?
echo 1) Android only
echo 2) Both Android and iOS (will skip iOS on Windows)
set /p choice="Enter choice (1-2): "

REM Install Capacitor core
echo.
echo 📦 Installing Capacitor...
call npm install @capacitor/core @capacitor/cli --save

REM Initialize Capacitor
echo.
echo 🔧 Initializing Capacitor...
call npx cap init "Bhagavad Gita" "com.yourdomain.gita" --web-dir .

REM Install Android
echo.
echo 🤖 Setting up Android...
call npm install @capacitor/android --save
call npx cap add android
call npx cap sync android

echo.
echo ✅ Android setup complete!
echo.
echo 📱 Next steps:
echo 1. Install Android Studio from: https://developer.android.com/studio
echo 2. Open Android Studio: npx cap open android
echo 3. Wait for Gradle sync
echo 4. Build ^> Generate Signed Bundle/APK
echo.

if "%choice%"=="2" (
    echo ⚠️  Note: iOS development requires a Mac
    echo    iOS setup skipped on Windows
    echo.
)

echo ============================================
echo ✨ Setup Complete!
echo.
echo 📋 Important Files Created:
echo    - node_modules/ (dependencies)
echo    - android/ (Android project)
echo.
echo 💡 To open Android Studio:
echo    npx cap open android
echo.
echo 📚 Full documentation in NATIVE_APPS.md
echo ============================================
echo.
pause
