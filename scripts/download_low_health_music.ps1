# Download unique hard-core tension music for low-health mode (< 25% HP).
# Saves to public/assets/music/tension_low_health.mp3 (browser supports MP3).
# Run once: .\scripts\download_low_health_music.ps1

$ErrorActionPreference = "Stop"
$outDir = Join-Path (Join-Path $PSScriptRoot "..") "public\assets\music"
$outFile = Join-Path $outDir "tension_low_health.mp3"

# CC0 / GPL tension track (Suspense/Tension Theme - OpenGameArt, TheMindnaut)
$url = "https://opengameart.org/sites/default/files/Tension3_0.mp3"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$client = New-Object System.Net.WebClient
$client.Headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

Write-Host "Downloading low-health tension track..."
try {
    $client.DownloadFile($url, $outFile)
    Write-Host "Saved: $outFile"
} catch {
    Write-Host "Download failed. You can manually add a tension/danger loop:"
    Write-Host "  1. Get a CC0 tension track (e.g. OpenGameArt 'Suspense/Tension Theme', Freesound CC0 suspense loop)"
    Write-Host "  2. Save as: $outFile"
    Write-Host "  Or as OGG: $outDir\tension_low_health.ogg"
    exit 1
}
