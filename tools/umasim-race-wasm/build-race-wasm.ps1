# umasim :race WASM ビルド＆ desktop-app/public/umaemu/ へコピー
# 前提: umasim を sibling に clone 済み、JDK 17+

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$UmasimRoot = Join-Path (Split-Path $RepoRoot -Parent) "umasim-temp"
$WasmSrc = $PSScriptRoot
$RaceWasm = Join-Path $UmasimRoot "race\src\wasmJsMain\kotlin\io\github\mee1080\umasim\race\WasmEngine.kt"
$SkillDataPatch = Join-Path $WasmSrc "SkillData.patch.md"
$DistDir = Join-Path $UmasimRoot "race\build\dist\wasmJs\productionExecutable"
$DestDir = Join-Path $RepoRoot "desktop-app\public\umaemu"

Write-Host "Copying WASM bridge sources to umasim..."
New-Item -ItemType Directory -Force -Path (Split-Path $RaceWasm -Parent) | Out-Null
Copy-Item (Join-Path $WasmSrc "WasmEngine.kt") $RaceWasm -Force
Write-Host "NOTE: SkillData.kt への initSkillDataFromJson 追記は $SkillDataPatch を参照"

Write-Host "Building :race:wasmJsBrowserDistribution..."
Push-Location $UmasimRoot
.\gradlew.bat :race:wasmJsBrowserDistribution
Pop-Location

Write-Host "Copying artifacts to $DestDir ..."
Get-ChildItem $DestDir -Filter "*.wasm" | ForEach-Object { Remove-Item $_.FullName -Force }
Copy-Item (Join-Path $DistDir "race.js") $DestDir -Force
Copy-Item (Join-Path $DistDir "race.js.map") $DestDir -Force
Copy-Item (Join-Path $DistDir "*.wasm") $DestDir -Force
Write-Host "Done."
