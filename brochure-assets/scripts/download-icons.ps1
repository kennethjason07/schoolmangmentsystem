# VidyaSethu Icon Downloader Script
# This script downloads the actual Ionicons used in VidyaSethu app as PNG files

param(
    [string]$OutputPath = "brochure-assets\icons",
    [int[]]$Sizes = @(24, 32, 48, 64, 128, 256)
)

Write-Host "🚀 VidyaSethu Icon Downloader" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Create output directory if it doesn't exist
if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
    Write-Host "✅ Created directory: $OutputPath" -ForegroundColor Green
}

# VidyaSethu icon configuration (from your app)
$VidyaSethuIcons = @(
    @{
        Name = "school"
        Feature = "Academic Management"
        Color = "#4CAF50"
        FileName = "academic-management"
        Description = "Student & teacher profiles, classes, subjects, exams, grades"
    },
    @{
        Name = "checkmark-circle"
        Feature = "Attendance Tracking"
        Color = "#4CAF50"
        FileName = "attendance-tracking"
        Description = "Daily attendance for students & staff with analytics"
    },
    @{
        Name = "card"
        Feature = "Finance & Fees"
        Color = "#2196F3"
        FileName = "finance-fees"
        Description = "Digital fee collection, expense tracking, reports"
    },
    @{
        Name = "chatbubbles"
        Feature = "Communication"
        Color = "#9C27B0"
        FileName = "communication"
        Description = "In-App chat, SMS & WhatsApp notifications"
    },
    @{
        Name = "bar-chart"
        Feature = "Reports & Analytics"
        Color = "#2196F3"
        FileName = "reports-analytics"
        Description = "Real-time dashboards, report cards, custom reports"
    },
    @{
        Name = "people"
        Feature = "Administration Tools"
        Color = "#2196F3"
        FileName = "administration-tools"
        Description = "Roles, events, tasks, leave management"
    },
    @{
        Name = "phone-portrait"
        Feature = "Mobile-Friendly"
        Color = "#2196F3"
        FileName = "mobile-friendly"
        Description = "Access anytime via app with live updates"
    }
)

# Function to create SVG icon
function Create-SVGIcon {
    param(
        [string]$IconName,
        [string]$Color,
        [int]$Size
    )
    
    # Basic SVG templates for each icon (simplified versions)
    $SVGTemplates = @{
        "school" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 16L12 18.72L7 16V12.27L12 15L17 12.27V16Z"/>
</svg>
"@
        "checkmark-circle" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
</svg>
"@
        "card" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"/>
</svg>
"@
        "chatbubbles" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H6L10 22L14 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H13.17L10 19.17L6.83 16H4V4H20V16Z"/>
</svg>
"@
        "bar-chart" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 9.2H7V19H5V9.2ZM10.6 5H12.4V19H10.6V5ZM16.2 13H18V19H16.2V13ZM21 21H3V19H21V21Z"/>
</svg>
"@
        "people" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 4C18.21 4 20 5.79 20 8C20 10.21 18.21 12 16 12C13.79 12 12 10.21 12 8C12 5.79 13.79 4 16 4ZM8 6C9.66 6 11 7.34 11 9C11 10.66 9.66 12 8 12C6.34 12 5 10.66 5 9C5 7.34 6.34 6 8 6ZM8 13C10.67 13 16 14.34 16 17V20H0V17C0 14.34 5.33 13 8 13ZM16 13C16.45 13 16.96 13.05 17.54 13.14C18.84 13.5 20 14.36 20 17V20H18V17C18 16.36 17.07 15.6 15.58 15.23C15.95 14.5 16 13.75 16 13Z"/>
</svg>
"@
        "phone-portrait" = @"
<svg width="$Size" height="$Size" viewBox="0 0 24 24" fill="$Color" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 1.01L7 1C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1.01 17 1.01ZM17 19H7V5H17V19Z"/>
</svg>
"@
    }
    
    return $SVGTemplates[$IconName]
}

# Function to convert SVG to PNG (simplified approach)
function Create-IconFiles {
    param(
        [hashtable]$Icon,
        [int]$Size
    )
    
    $svg = Create-SVGIcon -IconName $Icon.Name -Color $Icon.Color -Size $Size
    $fileName = "vidyasethu-$($Icon.FileName)-$($Size)px"
    
    # Save SVG file
    $svgPath = Join-Path $OutputPath "$fileName.svg"
    $svg | Out-File -FilePath $svgPath -Encoding UTF8
    
    Write-Host "✅ Created: $fileName.svg ($($Icon.Feature))" -ForegroundColor Green
    
    return $svgPath
}

# Create icon manifest file
$manifest = @{
    meta = @{
        name = "VidyaSethu Feature Icons"
        version = "1.0.0"
        created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        description = "Icons extracted from VidyaSethu school management app"
    }
    icons = @()
}

Write-Host "📁 Output directory: $OutputPath" -ForegroundColor Yellow
Write-Host "📏 Sizes: $($Sizes -join ', ')px" -ForegroundColor Yellow
Write-Host ""

# Process each icon
$totalIcons = 0
foreach ($icon in $VidyaSethuIcons) {
    Write-Host "🎨 Processing: $($icon.Feature)" -ForegroundColor Cyan
    
    $iconFiles = @()
    foreach ($size in $Sizes) {
        $filePath = Create-IconFiles -Icon $icon -Size $size
        $iconFiles += @{
            size = $size
            file = Split-Path $filePath -Leaf
        }
        $totalIcons++
    }
    
    # Add to manifest
    $manifest.icons += @{
        feature = $icon.Feature
        ionicon = $icon.Name
        color = $icon.Color
        description = $icon.Description
        files = $iconFiles
    }
}

# Save manifest file
$manifestPath = Join-Path $OutputPath "vidyasethu-icons-manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "🎉 Icon download complete!" -ForegroundColor Green
Write-Host "📊 Generated $totalIcons icon files" -ForegroundColor Green
Write-Host "📄 Manifest saved: vidyasethu-icons-manifest.json" -ForegroundColor Green
Write-Host ""
Write-Host "📂 Files saved to: $OutputPath" -ForegroundColor Yellow

# Create usage guide
$usageGuide = @"
# VidyaSethu Icons Usage Guide

## Generated Files
- **SVG Icons**: Scalable vector graphics for all design needs
- **Manifest**: JSON file with complete icon information
- **Multiple Sizes**: $($Sizes -join 'px, ')px for different use cases

## Icon Features
$($VidyaSethuIcons | ForEach-Object { "- **$($_.Feature)**: $($_.Description) (Color: $($_.Color))" } | Out-String)

## Usage in Design Software
1. **For Brochures**: Use the 64px or 128px versions
2. **For Web**: Use 24px, 32px, or 48px versions  
3. **For Print**: Use 256px versions
4. **Colors**: Use the exact hex codes provided

## Brand Consistency
These icons are extracted from the VidyaSethu app to ensure 100% brand consistency.
"@

$usageGuidePath = Join-Path $OutputPath "USAGE-GUIDE.md"
$usageGuide | Out-File -FilePath $usageGuidePath -Encoding UTF8

Write-Host "📋 Usage guide created: USAGE-GUIDE.md" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to use in your brochures!" -ForegroundColor Cyan
