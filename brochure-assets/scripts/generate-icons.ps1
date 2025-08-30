# VidyaSethu Icon Generator Script
# This script generates SVG icons used in VidyaSethu app

Write-Host "VidyaSethu Icon Generator" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

# Create output directory
$OutputPath = "brochure-assets\icons"
if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
    Write-Host "Created directory: $OutputPath" -ForegroundColor Yellow
}

# VidyaSethu icon configuration
$icons = @(
    @{ Name = "school"; Feature = "Academic Management"; Color = "#4CAF50"; FileName = "academic-management" },
    @{ Name = "checkmark-circle"; Feature = "Attendance Tracking"; Color = "#4CAF50"; FileName = "attendance-tracking" },
    @{ Name = "card"; Feature = "Finance & Fees"; Color = "#2196F3"; FileName = "finance-fees" },
    @{ Name = "chatbubbles"; Feature = "Communication"; Color = "#9C27B0"; FileName = "communication" },
    @{ Name = "bar-chart"; Feature = "Reports & Analytics"; Color = "#2196F3"; FileName = "reports-analytics" },
    @{ Name = "people"; Feature = "Administration Tools"; Color = "#2196F3"; FileName = "administration-tools" },
    @{ Name = "phone-portrait"; Feature = "Mobile-Friendly"; Color = "#2196F3"; FileName = "mobile-friendly" }
)

# SVG templates
$svgTemplates = @{
    "school" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 16L12 18.72L7 16V12.27L12 15L17 12.27V16Z"/></svg>'
    "checkmark-circle" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/></svg>'
    "card" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"/></svg>'
    "chatbubbles" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H6L10 22L14 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H13.17L10 19.17L6.83 16H4V4H20V16Z"/></svg>'
    "bar-chart" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M5 9.2H7V19H5V9.2ZM10.6 5H12.4V19H10.6V5ZM16.2 13H18V19H16.2V13ZM21 21H3V19H21V21Z"/></svg>'
    "people" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M16 4C18.21 4 20 5.79 20 8C20 10.21 18.21 12 16 12C13.79 12 12 10.21 12 8C12 5.79 13.79 4 16 4ZM8 6C9.66 6 11 7.34 11 9C11 10.66 9.66 12 8 12C6.34 12 5 10.66 5 9C5 7.34 6.34 6 8 6ZM8 13C10.67 13 16 14.34 16 17V20H0V17C0 14.34 5.33 13 8 13ZM16 13C16.45 13 16.96 13.05 17.54 13.14C18.84 13.5 20 14.36 20 17V20H18V17C18 16.36 17.07 15.6 15.58 15.23C15.95 14.5 16 13.75 16 13Z"/></svg>'
    "phone-portrait" = '<svg width="{0}" height="{0}" viewBox="0 0 24 24" fill="{1}"><path d="M17 1.01L7 1C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1.01 17 1.01ZM17 19H7V5H17V19Z"/></svg>'
}

# Generate icons in multiple sizes
$sizes = @(24, 32, 48, 64, 128, 256)
$totalGenerated = 0

foreach ($icon in $icons) {
    Write-Host "Processing: $($icon.Feature)" -ForegroundColor Cyan
    
    foreach ($size in $sizes) {
        $svg = $svgTemplates[$icon.Name] -f $size, $icon.Color
        $fileName = "vidyasethu-$($icon.FileName)-$($size)px.svg"
        $filePath = Join-Path $OutputPath $fileName
        
        $svg | Out-File -FilePath $filePath -Encoding UTF8
        $totalGenerated++
        
        Write-Host "  Created: $fileName" -ForegroundColor Green
    }
}

# Create manifest
$manifest = @{
    meta = @{
        name = "VidyaSethu Feature Icons"
        version = "1.0.0" 
        created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        description = "Icons from VidyaSethu school management app"
        totalFiles = $totalGenerated
    }
    icons = $icons | ForEach-Object {
        @{
            feature = $_.Feature
            ionicon = $_.Name
            color = $_.Color
            fileName = $_.FileName
            sizes = $sizes
        }
    }
} | ConvertTo-Json -Depth 5

$manifestPath = Join-Path $OutputPath "manifest.json"
$manifest | Out-File -FilePath $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "COMPLETED!" -ForegroundColor Green
Write-Host "Generated $totalGenerated icon files" -ForegroundColor Green
Write-Host "Files saved to: $OutputPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Icons are ready for your brochure!" -ForegroundColor Green
