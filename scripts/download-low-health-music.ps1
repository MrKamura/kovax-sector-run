# Download "Dark Ambience Loop" (CC-BY 3.0 / GPL) for low-health tension music.
# Credit: Dark Ambience Loop by Iwan Gabovitch qubodup.net
# Source: https://opengameart.org/content/dark-ambience-loop

$url = "https://opengameart.org/sites/default/files/Iwan%20Gabovitch%20-%20Dark%20Ambience%20Loop.ogg"
$outDir = Resolve-Path (Join-Path $PSScriptRoot "..\public\assets\music")
$outPath = Join-Path $outDir "tension_low_health.ogg"

if (-not (Test-Path $outDir)) {
    Write-Error "Directory not found: $outDir"
    exit 1
}

Write-Host "Downloading Dark Ambience Loop to $outPath ..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing
    Write-Host "Done. tension_low_health.ogg installed. Credit: Dark Ambience Loop by Iwan Gabovitch (opengameart.org/content/dark-ambience-loop)"
} catch {
    Write-Error "Download failed: $_"
    exit 1
}
