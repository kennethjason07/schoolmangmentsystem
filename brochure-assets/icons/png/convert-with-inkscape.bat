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
    for %%f in ("brochure-assets\icons\*.svg") do (
        echo Converting: %%~nf.svg
        "C:\Program Files\Inkscape\bin\inkscape.exe" --export-type=png --export-filename="brochure-assets\icons\png\%%~nf.png" "%%f"
    )
    echo Conversion complete!
) else (
    echo Inkscape not found. Please install Inkscape first.
    echo Download from: https://inkscape.org/release/
)

pause
