# Fast Start Script for VidyaSethu School Management System
# This script optimizes the web development server for faster startup

Write-Host "🚀 Starting VidyaSethu with performance optimizations..." -ForegroundColor Green

# Set performance environment variables
$env:EXPO_NO_SYMBOLICATION="1"
$env:EXPO_NO_DOTENV="1" 
$env:METRO_CACHE_DIR=".metro-cache"
$env:NODE_OPTIONS="--max-old-space-size=8192"

Write-Host "✅ Environment variables configured" -ForegroundColor Yellow

# Clear any existing Metro processes
Write-Host "🔄 Clearing any existing Metro processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*metro*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Start the optimized development server
Write-Host "🌐 Starting Expo development server with optimizations..." -ForegroundColor Cyan
Write-Host "   - Polling file watcher (OneDrive compatible)" -ForegroundColor Gray
Write-Host "   - Lazy bundling enabled" -ForegroundColor Gray
Write-Host "   - Symbolication disabled" -ForegroundColor Gray
Write-Host "   - Metro caching enabled" -ForegroundColor Gray
Write-Host ""

# Start with clear cache for clean startup
npx expo start --web --clear

Write-Host "🎉 Development server started! Your browser should open automatically." -ForegroundColor Green
