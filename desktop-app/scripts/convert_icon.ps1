Add-Type -AssemblyName System.Drawing
$src = "C:\Users\PC1\.gemini\antigravity\brain\da3df21d-8907-43b0-97af-8b6b9c4cd531\umamusume_horseshoe_icon_1780054046026.png"
$dest = "c:\Users\PC1\Documents\google antigravity\Umamusume-Auto-DB\src-tauri\icons\icon.png"
$img = [System.Drawing.Image]::FromFile($src)
$img.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
