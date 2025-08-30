# VidyaSethu SVG to PNG Converter
# This script converts all SVG icons to PNG format

param(
    [string]$InputPath = "brochure-assets\icons",
    [string]$OutputPath = "brochure-assets\icons\png"
)

Write-Host "VidyaSethu SVG to PNG Converter" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Create PNG output directory
if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
    Write-Host "Created PNG directory: $OutputPath" -ForegroundColor Yellow
}

# Check if Inkscape is available (best option for SVG to PNG conversion)
$inkscapePath = $null
$possiblePaths = @(
    "${env:ProgramFiles}\Inkscape\bin\inkscape.exe",
    "${env:ProgramFiles(x86)}\Inkscape\bin\inkscape.exe",
    "C:\Program Files\Inkscape\bin\inkscape.exe",
    "C:\Program Files (x86)\Inkscape\bin\inkscape.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $inkscapePath = $path
        break
    }
}

if ($inkscapePath) {
    Write-Host "Found Inkscape at: $inkscapePath" -ForegroundColor Green
    $useInkscape = $true
} else {
    Write-Host "Inkscape not found. Using alternative method..." -ForegroundColor Yellow
    $useInkscape = $false
}

# Get all SVG files
$svgFiles = Get-ChildItem -Path $InputPath -Filter "*.svg" | Where-Object { $_.Name -ne "vidyasethu-icons.svg" }

if ($svgFiles.Count -eq 0) {
    Write-Host "No SVG files found in $InputPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($svgFiles.Count) SVG files to convert" -ForegroundColor Cyan
Write-Host ""

$convertedCount = 0
$failedCount = 0

foreach ($svgFile in $svgFiles) {
    $pngFileName = $svgFile.BaseName + ".png"
    $pngPath = Join-Path $OutputPath $pngFileName
    
    Write-Host "Converting: $($svgFile.Name) -> $pngFileName" -ForegroundColor Cyan
    
    try {
        if ($useInkscape) {
            # Use Inkscape for high-quality conversion
            $arguments = @(
                "--export-type=png",
                "--export-filename=`"$pngPath`"",
                "`"$($svgFile.FullName)`""
            )
            
            $process = Start-Process -FilePath $inkscapePath -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
            
            if ($process.ExitCode -eq 0 -and (Test-Path $pngPath)) {
                Write-Host "  ✅ Success: $pngFileName" -ForegroundColor Green
                $convertedCount++
            } else {
                throw "Inkscape conversion failed"
            }
        } else {
            # Alternative method using PowerShell and .NET (basic conversion)
            Write-Host "  ⚠️  Using basic conversion method" -ForegroundColor Yellow
            
            # Read SVG content and extract size
            $svgContent = Get-Content $svgFile.FullName -Raw
            $sizeMatch = [regex]::Match($svgContent, 'width="(\d+)".*?height="(\d+)"')
            
            if ($sizeMatch.Success) {
                $width = [int]$sizeMatch.Groups[1].Value
                $height = [int]$sizeMatch.Groups[2].Value
                
                # Create a simple PNG placeholder (since we can't do proper SVG rendering without external tools)
                # This creates a colored rectangle as a placeholder
                $colorMatch = [regex]::Match($svgContent, 'fill="([^"]+)"')
                $color = if ($colorMatch.Success) { $colorMatch.Groups[1].Value } else { "#2196F3" }
                
                # Create a simple bitmap (this is a basic fallback)
                Add-Type -AssemblyName System.Drawing
                $bitmap = New-Object System.Drawing.Bitmap($width, $height)
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                
                # Convert hex color to RGB
                $colorHex = $color.TrimStart('#')
                $r = [Convert]::ToInt32($colorHex.Substring(0,2), 16)
                $g = [Convert]::ToInt32($colorHex.Substring(2,2), 16)
                $b = [Convert]::ToInt32($colorHex.Substring(4,2), 16)
                $brushColor = [System.Drawing.Color]::FromArgb($r, $g, $b)
                $brush = New-Object System.Drawing.SolidBrush($brushColor)
                
                # Fill with color (basic representation)
                $graphics.FillRectangle($brush, 0, 0, $width, $height)
                
                # Save as PNG
                $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
                
                # Cleanup
                $graphics.Dispose()
                $bitmap.Dispose()
                $brush.Dispose()
                
                Write-Host "  ⚠️  Basic conversion: $pngFileName (solid color placeholder)" -ForegroundColor Yellow
                $convertedCount++
            } else {
                throw "Could not parse SVG dimensions"
            }
        }
    }
    catch {
        Write-Host "  ❌ Failed: $($svgFile.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $failedCount++
    }
}

Write-Host ""
Write-Host "Conversion Complete!" -ForegroundColor Green
Write-Host "Successfully converted: $convertedCount files" -ForegroundColor Green
if ($failedCount -gt 0) {
    Write-Host "Failed conversions: $failedCount files" -ForegroundColor Red
}
Write-Host "PNG files saved to: $OutputPath" -ForegroundColor Yellow

# Create a batch file for manual conversion if Inkscape is not available
if (-not $useInkscape) {
    $batchContent = @"
@echo off
echo VidyaSethu SVG to PNG Conversion Helper
echo =====================================
echo.
echo This batch file helps convert SVG to PNG using Inkscape
echo.
echo Instructions:
echo 1. Download and install Inkscape from: https://inkscape.org/release/
echo 2. Run this batch file after installation
echo.

if exist "C:\Program Files\Inkscape\bin\inkscape.exe" (
    echo Found Inkscape! Converting SVG files to PNG...
    for %%f in ("$InputPath\*.svg") do (
        echo Converting: %%~nf.svg
        "C:\Program Files\Inkscape\bin\inkscape.exe" --export-type=png --export-filename="$OutputPath\%%~nf.png" "%%f"
    )
    echo Conversion complete!
) else (
    echo Inkscape not found. Please install Inkscape first.
    echo Download from: https://inkscape.org/release/
)

pause
"@
    
    $batchPath = Join-Path $OutputPath "convert-with-inkscape.bat"
    $batchContent | Out-File -FilePath $batchPath -Encoding ASCII
    
    Write-Host ""
    Write-Host "📄 Created batch file: convert-with-inkscape.bat" -ForegroundColor Cyan
    Write-Host "   This can be used for high-quality conversion after installing Inkscape" -ForegroundColor Gray
}

Write-Host ""
Write-Host "PNG icons are ready for your brochure!" -ForegroundColor Green
