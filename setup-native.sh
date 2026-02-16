#!/bin/bash

# Bhagavad Gita App - Native Build Setup Script
# This script sets up everything needed to build native Android/iOS apps

echo "🕉️  Bhagavad Gita App - Native Build Setup"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "📥 Please install Node.js from: https://nodejs.org/"
    echo "   Download version 16 or higher"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Ask which platform
echo "Which platform do you want to build for?"
echo "1) Android only"
echo "2) iOS only (Mac required)"
echo "3) Both Android and iOS"
read -p "Enter choice (1-3): " choice

# Install Capacitor core
echo ""
echo "📦 Installing Capacitor..."
npm install @capacitor/core @capacitor/cli --save

# Initialize Capacitor
echo ""
echo "🔧 Initializing Capacitor..."
npx cap init "Bhagavad Gita" "com.yourdomain.gita" --web-dir .

# Install platforms based on choice
case $choice in
    1)
        echo ""
        echo "🤖 Setting up Android..."
        npm install @capacitor/android --save
        npx cap add android
        npx cap sync android
        echo ""
        echo "✅ Android setup complete!"
        echo ""
        echo "📱 Next steps:"
        echo "1. Open Android Studio: npx cap open android"
        echo "2. Wait for Gradle sync"
        echo "3. Build > Generate Signed Bundle/APK"
        ;;
    2)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo ""
            echo "🍎 Setting up iOS..."
            npm install @capacitor/ios --save
            npx cap add ios
            npx cap sync ios
            echo ""
            echo "✅ iOS setup complete!"
            echo ""
            echo "📱 Next steps:"
            echo "1. Open Xcode: npx cap open ios"
            echo "2. Select your development team"
            echo "3. Configure signing"
            echo "4. Product > Archive"
        else
            echo "❌ iOS development requires a Mac"
            echo "   You can only build for iOS on macOS"
            exit 1
        fi
        ;;
    3)
        echo ""
        echo "🤖 Setting up Android..."
        npm install @capacitor/android --save
        npx cap add android
        npx cap sync android
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo ""
            echo "🍎 Setting up iOS..."
            npm install @capacitor/ios --save
            npx cap add ios
            npx cap sync ios
            echo ""
            echo "✅ Both platforms setup complete!"
            echo ""
            echo "📱 Next steps:"
            echo "Android: npx cap open android"
            echo "iOS: npx cap open ios"
        else
            echo ""
            echo "✅ Android setup complete!"
            echo "⚠️  iOS requires a Mac - skipping iOS setup"
            echo ""
            echo "📱 Next steps:"
            echo "Android: npx cap open android"
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "============================================"
echo "✨ Setup Complete!"
echo ""
echo "📋 Important Files Created:"
echo "   - node_modules/ (dependencies)"
echo "   - android/ (if Android selected)"
echo "   - ios/ (if iOS selected)"
echo ""
echo "💡 To build apps later:"
echo "   Update: npx cap sync"
echo "   Android: npx cap open android"
echo "   iOS: npx cap open ios"
echo ""
echo "📚 Full documentation in NATIVE_APPS.md"
echo "============================================"
