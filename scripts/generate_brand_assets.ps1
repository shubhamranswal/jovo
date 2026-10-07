# generate_brand_assets.ps1
param (
    [string]$SourcePath = "C:\Users\shubh\Downloads\jovo_logo.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source logo file not found at $SourcePath"
    exit 1
}

$brandDir = "assets\brand"
$extIconDir = "apps\extension\icons"
$webPublicDir = "apps\web\public"

New-Item -ItemType Directory -Force -Path $brandDir | Out-Null
New-Item -ItemType Directory -Force -Path $extIconDir | Out-Null
New-Item -ItemType Directory -Force -Path $webPublicDir | Out-Null

# Copy canonical logo
Copy-Item -Path $SourcePath -Destination (Join-Path $brandDir "jovo-logo.png") -Force
Copy-Item -Path $SourcePath -Destination (Join-Path $webPublicDir "jovo-logo.png") -Force

Write-Host "Canonical master logo copied to $brandDir\jovo-logo.png and $webPublicDir\jovo-logo.png"

$sourceImg = [System.Drawing.Image]::FromFile($SourcePath)

function Resize-Image {
    param (
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$DestinationPath
    )

    $destBitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)

    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $graphics.DrawImage($Image, 0, 0, $Width, $Height)
    $graphics.Dispose()

    $destBitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Generated $DestinationPath ($Width x $Height)"
}

# 1. Generate brand assets
$sizes = @(16, 32, 48, 64, 128, 256)
foreach ($s in $sizes) {
    $outPath = Join-Path $brandDir "jovo-logo-$s.png"
    Resize-Image -Image $sourceImg -Width $s -Height $s -DestinationPath $outPath
}

# Also copy logo sizes to web public for web UI consumption
foreach ($s in $sizes) {
    Copy-Item -Path (Join-Path $brandDir "jovo-logo-$s.png") -Destination (Join-Path $webPublicDir "jovo-logo-$s.png") -Force
}

# 2. Extension icons (16, 32, 48, 128)
foreach ($s in @(16, 32, 48, 128)) {
    $outPath = Join-Path $extIconDir "icon-$s.png"
    Resize-Image -Image $sourceImg -Width $s -Height $s -DestinationPath $outPath
}

# 3. Web icons (favicon 32x32, 48x48, 192, 512, apple-icon 180)
Resize-Image -Image $sourceImg -Width 32 -Height 32 -DestinationPath (Join-Path $webPublicDir "favicon-32x32.png")
Resize-Image -Image $sourceImg -Width 16 -Height 16 -DestinationPath (Join-Path $webPublicDir "favicon-16x16.png")
Resize-Image -Image $sourceImg -Width 180 -Height 180 -DestinationPath (Join-Path $webPublicDir "apple-touch-icon.png")
Resize-Image -Image $sourceImg -Width 192 -Height 192 -DestinationPath (Join-Path $webPublicDir "icon-192.png")
Resize-Image -Image $sourceImg -Width 512 -Height 512 -DestinationPath (Join-Path $webPublicDir "icon-512.png")

# Also save 32x32 bitmap as ICO in brand and web public
$ico32 = New-Object System.Drawing.Bitmap($sourceImg, 32, 32)
$icoHandle = $ico32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($icoHandle)
$stream = [System.IO.File]::OpenWrite((Join-Path $brandDir "jovo-favicon.ico"))
$icon.Save($stream)
$stream.Close()
$stream2 = [System.IO.File]::OpenWrite((Join-Path $webPublicDir "favicon.ico"))
$icon.Save($stream2)
$stream2.Close()

$icon.Dispose()
$ico32.Dispose()

Write-Host "Generated favicon.ico in brand and public."

# 4. Generate Open Graph image (1200 x 630)
# Clean, professional dark card with canonical Jovo symbol, Jovo wordmark, and tagline
$ogWidth = 1200
$ogHeight = 630
$ogBitmap = New-Object System.Drawing.Bitmap($ogWidth, $ogHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ogGraphics = [System.Drawing.Graphics]::FromImage($ogBitmap)
$ogGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ogGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ogGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Dark slate background #090d16
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 9, 13, 22))
$ogGraphics.FillRectangle($bgBrush, 0, 0, $ogWidth, $ogHeight)
$bgBrush.Dispose()

# Subtle accent border
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 30, 41, 59), 2)
$ogGraphics.DrawRectangle($borderPen, 20, 20, $ogWidth - 40, $ogHeight - 40)
$borderPen.Dispose()

# Draw Jovo symbol centered vertically on the left: size 260x260
$logoSize = 260
$logoX = 140
$logoY = [int](($ogHeight - $logoSize) / 2)
$ogGraphics.DrawImage($sourceImg, $logoX, $logoY, $logoSize, $logoSize)

# Draw Brand Title: "Jovo"
$titleFont = New-Object System.Drawing.Font("Segoe UI", 68, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
$ogGraphics.DrawString("Jovo", $titleFont, $titleBrush, 450, 190)
$titleFont.Dispose()
$titleBrush.Dispose()

# Draw Tagline: "Apply smarter. Get hired faster."
$taglineFont = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Regular)
$taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 96, 165, 250)) # blue-400
$ogGraphics.DrawString("Apply smarter. Get hired faster.", $taglineFont, $taglineBrush, 455, 305)
$taglineFont.Dispose()
$taglineBrush.Dispose()

# Draw Subtitle/Features: "AI-assisted job search • Application Capsule • Real-time memory"
$descFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
$descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184)) # slate-400
$ogGraphics.DrawString("AI-assisted job applications • Application Capsule • Interview preparation", $descFont, $descBrush, 455, 370)
$descFont.Dispose()
$descBrush.Dispose()

$ogPath = Join-Path $brandDir "jovo-og-image.png"
$ogBitmap.Save($ogPath, [System.Drawing.Imaging.ImageFormat]::Png)
$ogPublicPath = Join-Path $webPublicDir "og-image.png"
$ogBitmap.Save($ogPublicPath, [System.Drawing.Imaging.ImageFormat]::Png)
$ogBitmap.Dispose()
$ogGraphics.Dispose()

Write-Host "Generated Open Graph social preview image: $ogPath and $ogPublicPath"

$sourceImg.Dispose()
Write-Host "All Jovo brand assets generated successfully!"
