# 設計パック画像から crop 領域・タブ行・ヘッダー下端を計測
param(
    [string]$Root = (Join-Path $PSScriptRoot "..\auto-capture-design-pack")
)

Add-Type -AssemblyName System.Drawing

function Test-GreenPixel([System.Drawing.Color]$c) {
    return ($c.G -ge 100) -and ($c.G -gt $c.R + 30) -and ($c.G -gt $c.B + 20)
}

function Get-CropRect([System.Drawing.Bitmap]$bmp) {
    $searchH = [Math]::Floor($bmp.Height * 0.3)
    $maxW = 0
    $widestLeft = -1
    $widestRight = -1
    $headerY = -1

    for ($y = 0; $y -lt $searchH; $y++) {
        $first = -1
        $last = -1
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            if (Test-GreenPixel $bmp.GetPixel($x, $y)) {
                if ($first -lt 0) { $first = $x }
                $last = $x
            }
        }
        if ($first -ge 0) {
            $w = $last - $first + 1
            if ($w -gt $maxW) {
                $maxW = $w
                $widestLeft = $first
                $widestRight = $last
            }
        }
    }

    for ($y = 0; $y -lt $searchH; $y++) {
        $first = -1
        $last = -1
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            if (Test-GreenPixel $bmp.GetPixel($x, $y)) {
                if ($first -lt 0) { $first = $x }
                $last = $x
            }
        }
        if ($first -ge 0) {
            $w = $last - $first + 1
            if ($w -ge $maxW * 0.95) {
                $headerY = $y
                break
            }
        }
    }

    if ($headerY -lt 0 -or $maxW -lt 100) { return $null }

    $uiW = $widestRight - $widestLeft + 1
    $uiH = [Math]::Floor($uiW / 0.5625)
    if ($headerY + $uiH -gt $bmp.Height) { $uiH = $bmp.Height - $headerY }

    return @{
        X = $widestLeft
        Y = $headerY
        Width = $uiW
        Height = $uiH
    }
}

function Measure-RowSignals([System.Drawing.Bitmap]$bmp, [int]$x0, [int]$y0, [int]$w, [int]$h, [int]$tabY, [int]$tabH) {
    $leftGreen = 0
    $rightGreen = 0
    $seg1Green = 0
    $seg2Green = 0
    $seg3Green = 0
    $leftTotal = 0
    $rightTotal = 0
    $seg1Total = 0
    $seg2Total = 0
    $seg3Total = 0
    $segW = [Math]::Floor($w / 3)
    $absY = $y0 + $tabY

    for ($dy = 0; $dy -lt $tabH; $dy++) {
        for ($dx = 0; $dx -lt $w; $dx++) {
            $px = $bmp.GetPixel($x0 + $dx, $absY + $dy)
            $isG = Test-GreenPixel $px
            if ($dx -lt [Math]::Floor($w * 0.48)) {
                $leftTotal++
                if ($isG) { $leftGreen++ }
            }
            elseif ($dx -ge [Math]::Floor($w * 0.52)) {
                $rightTotal++
                if ($isG) { $rightGreen++ }
            }
            if ($dx -lt $segW) {
                $seg1Total++
                if ($isG) { $seg1Green++ }
            }
            elseif ($dx -lt ($segW * 2)) {
                $seg2Total++
                if ($isG) { $seg2Green++ }
            }
            else {
                $seg3Total++
                if ($isG) { $seg3Green++ }
            }
        }
    }

    return [PSCustomObject]@{
        TabY = $tabY
        Ratio = [Math]::Round($tabY / $h, 3)
        L2Score = [Math]::Round(($rightGreen / [Math]::Max(1, $rightTotal)) - ($leftGreen / [Math]::Max(1, $leftTotal)), 3)
        Seg1 = [Math]::Round($seg1Green / [Math]::Max(1, $seg1Total), 3)
        Seg2 = [Math]::Round($seg2Green / [Math]::Max(1, $seg2Total), 3)
        Seg3 = [Math]::Round($seg3Green / [Math]::Max(1, $seg3Total), 3)
    }
}

function Analyze-Image([string]$Label, [string]$Path, [switch]$PreCropped) {
    if (-not (Test-Path $Path)) {
        Write-Output "SKIP $Label"
        return
    }
    $bmp = [System.Drawing.Bitmap]::FromFile($Path)
    Write-Output ""
    Write-Output "=== $Label ($($bmp.Width)x$($bmp.Height)) ==="

    if ($PreCropped) {
        $crop = @{ X = 0; Y = 0; Width = $bmp.Width; Height = $bmp.Height }
    }
    else {
        $crop = Get-CropRect $bmp
        if (-not $crop) {
            Write-Output "  crop detection FAILED"
            $bmp.Dispose()
            return
        }
    }
    Write-Output ("  crop: x={0} y={1} w={2} h={3}" -f $crop.X, $crop.Y, $crop.Width, $crop.Height)

    $tabH = [Math]::Max(4, [Math]::Floor($crop.Height * 0.035))
    $rows = @()
    for ($ratio = 0.05; $ratio -le 0.55; $ratio += 0.01) {
        $tabY = [Math]::Floor($crop.Height * $ratio)
        if ($tabY + $tabH -gt $crop.Height) { continue }
        $rows += Measure-RowSignals $bmp $crop.X $crop.Y $crop.Width $crop.Height $tabY $tabH
    }

    $bestL2 = $rows | Sort-Object L2Score -Descending | Select-Object -First 1
    $tabBottom = $bestL2.TabY + $tabH
    Write-Output ("  L2 peak: ratio={0} tabY={1}px headerBottom={2}px ({3:P1}) L2score={4}" -f `
        $bestL2.Ratio, $bestL2.TabY, $tabBottom, ($tabBottom / $crop.Height), $bestL2.L2Score)

    $l3top = $rows | Where-Object { $_.Ratio -ge 0.08 -and $_.Ratio -le 0.16 } | Sort-Object Seg1 -Descending | Select-Object -First 1
    if ($l3top) {
        Write-Output ("  L3 band peak: ratio={0} tabY={1} seg1={2} seg2={3} seg3={4}" -f `
            $l3top.Ratio, $l3top.TabY, $l3top.Seg1, $l3top.Seg2, $l3top.Seg3)
    }

    $hasUpper3 = $rows | Where-Object { $_.Ratio -ge 0.08 -and $_.Ratio -le 0.16 -and $_.Seg1 -gt 0.15 } | Measure-Object
    Write-Output ("  upper-band green-active segments (8-16%): {0} rows" -f $hasUpper3.Count)

    $bmp.Dispose()
}

Analyze-Image "TRN-full" (Join-Path $Root "golden\TRN\frame_000.png")
Analyze-Image "TRN-crop" (Join-Path $Root "golden\TRN\frame_000.png") -PreCropped
Analyze-Image "HOF-full" (Join-Path $Root "golden\HOF\skill\frame_000.png")
Analyze-Image "HOF-crop" (Join-Path $Root "golden\HOF\skill\frame_000.png") -PreCropped
Analyze-Image "CMP-full" (Join-Path $Root "golden\CMP\skill\frame_000.png")
Analyze-Image "FRD-factor-full" (Join-Path $Root "golden\FRD\factor\frame_000.png")
