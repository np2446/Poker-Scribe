#!/bin/bash

# PokerScribe installation script

echo "📝 Installing PokerScribe dependencies..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "🔄 Running npm install..."
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🚀 To start the development server, run:"
    echo "npm run dev"
    echo ""
    echo "💻 Then open your browser and navigate to: http://localhost:3000"
else
    echo "❌ Dependency installation failed."
    echo ""
    echo "If you're experiencing dependency conflicts, try running:"
    echo "npm install --legacy-peer-deps"
    echo ""
    echo "Or for a more targeted approach:"
    echo "npm install date-fns@^3.3.1 --save-exact"
fi 