#!/bin/bash

# GitHub Pages Deployment Setup Script
# This script helps you deploy the AI Interview Guide to GitHub Pages

set -e

echo "🚀 AI Interview Guide - GitHub Pages Deployment Setup"
echo "========================================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git repository not found. Initializing..."
    git init
    echo "✅ Git initialized"
else
    echo "✅ Git repository found"
fi

# Check if changes exist
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ All files are committed"
else
    echo "📝 Found uncommitted changes. Committing..."
    git add .
    git commit -m "Add GitHub Pages deployment configuration"
    echo "✅ Changes committed"
fi

# Get current remote
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE" ]; then
    echo ""
    echo "⚠️  No GitHub remote found!"
    echo ""
    echo "Please provide your GitHub repository URL:"
    read -p "GitHub Repository URL (e.g., https://github.com/username/AI-for-Interview): " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo "❌ No URL provided. Exiting."
        exit 1
    fi
    
    git remote add origin "$REPO_URL"
    echo "✅ Remote added: $REPO_URL"
else
    echo "✅ Remote already configured: $REMOTE"
fi

echo ""
echo "========================================================"
echo "📋 Next Steps:"
echo "========================================================"
echo ""
echo "1️⃣  Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "2️⃣  Enable GitHub Pages:"
echo "   - Go to GitHub repository settings"
echo "   - Navigate to Pages"
echo "   - Select 'GitHub Actions' as source"
echo ""
echo "3️⃣  Visit your deployed site:"
echo "   https://[username].github.io/AI-for-Interview"
echo ""
echo "📚 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "✅ Setup complete! Ready for deployment! 🚀"
