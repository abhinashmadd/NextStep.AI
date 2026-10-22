Add-Type -AssemblyName System.Drawing

$publicDir = "D:\NextStep\public"
$heroOriginal = Join-Path $publicDir "hero_3d.jpg"
$heroTemp = Join-Path $publicDir "hero_3d_temp.jpg"

if (Test-Path $heroOriginal) {
    $bytes = [System.IO.File]::ReadAllBytes($heroOriginal)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Image]::FromStream($ms)

    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]80)

    $img.Save($heroTemp, $jpegCodec, $encoderParams)
    $img.Dispose()
    $ms.Dispose()

    $origSize = $bytes.Length
    $newSize = (Get-Item $heroTemp).Length
    Write-Host "hero_3d.jpg: $origSize bytes -> $newSize bytes"

    if ($newSize -lt $origSize) {
        Move-Item -Path $heroTemp -Destination $heroOriginal -Force
    } else {
        Remove-Item -Path $heroTemp -Force
    }
}

$logoOriginal = Join-Path $publicDir "nextstep-logo-transparent.png"
$logoTemp = Join-Path $publicDir "nextstep-logo_temp.png"

if (Test-Path $logoOriginal) {
    $bytes = [System.IO.File]::ReadAllBytes($logoOriginal)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $srcLogo = [System.Drawing.Image]::FromStream($ms)

    $targetWidth = 937
    $targetHeight = [int]($srcLogo.Height * ($targetWidth / $srcLogo.Width))
    $resized = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($resized)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.DrawImage($srcLogo, 0, 0, $targetWidth, $targetHeight)

    $resized.Save($logoTemp, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $resized.Dispose()
    $srcLogo.Dispose()
    $ms.Dispose()

    $origSize = $bytes.Length
    $newSize = (Get-Item $logoTemp).Length
    Write-Host "nextstep-logo-transparent.png: $origSize bytes -> $newSize bytes"

    if ($newSize -lt $origSize) {
        Move-Item -Path $logoTemp -Destination $logoOriginal -Force
    } else {
        Remove-Item -Path $logoTemp -Force
    }
}
