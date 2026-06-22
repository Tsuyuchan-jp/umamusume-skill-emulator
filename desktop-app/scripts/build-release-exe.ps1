# 配布用 app.exe をリポジトリ内 src-tauri/target/release に出力する。
# CARGO_TARGET_DIR を明示し、Cursor サンドボックスの一時 target を避ける。
$ErrorActionPreference = "Stop"
$desktopAppRoot = Split-Path $PSScriptRoot -Parent
$skillDataPath = Join-Path $desktopAppRoot "public\skill_data.txt"
if (-not (Test-Path $skillDataPath)) {
  throw "public/skill_data.txt not found. Run: npm run extract-umasim-skills"
}
if ((Get-Item $skillDataPath).Length -eq 0) {
  throw "public/skill_data.txt is empty. Run: npm run extract-umasim-skills"
}
$targetDir = Join-Path $desktopAppRoot "src-tauri\target"
$env:CARGO_TARGET_DIR = $targetDir
Set-Location $desktopAppRoot
npm run tauri -- build --no-bundle
$exePath = Join-Path $targetDir "release\app.exe"
if (-not (Test-Path $exePath)) {
  throw "app.exe not found: $exePath"
}
Get-Item $exePath | Format-List FullName, Length, LastWriteTime
