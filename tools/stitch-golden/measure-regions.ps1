# 設計パック画像から crop・タブ行・scrollStartY を計測し expectations.json と比較（R0）
param(
    [string]$RepoRoot = (Join-Path $PSScriptRoot "..\.."),
    [string]$CaseId = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ExpectationsPath = Join-Path $PSScriptRoot "expectations.json"
$Expectations = Get-Content $ExpectationsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$DesignPackRoot = Join-Path $RepoRoot $Expectations.designPackRoot

function Test-TabGreen([System.Drawing.Color]$c) {
    # OpenCV HSV 相当の簡易近似（measure-stitch-layout より厳しめ）
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
            if (Test-TabGreen $bmp.GetPixel($x, $y)) {
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
            if (Test-TabGreen $bmp.GetPixel($x, $y)) {
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
        X      = $widestLeft
        Y      = $headerY
        Width  = $uiW
        Height = $uiH
    }
}

function Measure-TabRowBest(
    [System.Drawing.Bitmap]$bmp,
    [int]$x0,
    [int]$y0,
    [int]$w,
    [int]$h,
    [string]$Layout,
    [double]$TabRowHeightRatio,
    [double]$TabBottomMarginRatio
) {
    $tabH = [Math]::Max(4, [Math]::Floor($h * $TabRowHeightRatio))
    $margin = [Math]::Max(1, [Math]::Floor($h * $TabBottomMarginRatio))

    # レイアウト別走査帯（R0 計測用。R1 以降 TS 側は absdiff 正本）
    switch ($Layout) {
        "L2" { $scanStart = 0.38; $scanEnd = 0.54; $mode = "l2" }
        "L3+Btn" { $scanStart = 0.17; $scanEnd = 0.28; $mode = "l3" }
        default { $scanStart = 0.28; $scanEnd = 0.48; $mode = "l3" }
    }

    $best = $null
    $bestScore = -1

    for ($ratio = $scanStart; $ratio -le $scanEnd; $ratio += 0.01) {
        $tabY = [Math]::Floor($h * $ratio)
        if ($tabY + $tabH -gt $h) { continue }

        $leftGreen = 0; $rightGreen = 0; $leftTotal = 0; $rightTotal = 0
        $segG = @(0, 0, 0); $segT = @(0, 0, 0)
        $segW = [Math]::Floor($w / 3)
        $absY = $y0 + $tabY

        for ($dy = 0; $dy -lt $tabH; $dy++) {
            for ($dx = 0; $dx -lt $w; $dx++) {
                $px = $bmp.GetPixel($x0 + $dx, $absY + $dy)
                $isG = Test-TabGreen $px
                if ($dx -lt [Math]::Floor($w * 0.48)) {
                    $leftTotal++
                    if ($isG) { $leftGreen++ }
                }
                elseif ($dx -ge [Math]::Floor($w * 0.52)) {
                    $rightTotal++
                    if ($isG) { $rightGreen++ }
                }
                $si = if ($dx -lt $segW) { 0 } elseif ($dx -lt ($segW * 2)) { 1 } else { 2 }
                $segT[$si]++
                if ($isG) { $segG[$si]++ }
            }
        }

        $l2Score = ($rightGreen / [Math]::Max(1, $rightTotal)) - ($leftGreen / [Math]::Max(1, $leftTotal))
        $seg1 = $segG[0] / [Math]::Max(1, $segT[0])
        $seg2 = $segG[1] / [Math]::Max(1, $segT[1])
        $seg3 = $segG[2] / [Math]::Max(1, $segT[2])
        $maxSeg = [Math]::Max($seg1, [Math]::Max($seg2, $seg3))

        $score = if ($mode -eq "l2") { $l2Score } else { $maxSeg }
        if ($score -gt $bestScore) {
            $bestScore = $score
            $scrollStart = $tabY + $tabH + $margin
            $best = [PSCustomObject]@{
                TabY             = $tabY
                TabRowRatio      = [Math]::Round($tabY / $h, 4)
                ScrollStartY     = $scrollStart
                ScrollStartRatio = [Math]::Round($scrollStart / $h, 4)
                Score            = [Math]::Round($score, 3)
                ScanMode         = $mode
            }
        }
    }

    return $best
}

function Test-GoldenCase($Case) {
    $frameRel = $Case.framePaths[0]
    $path = Join-Path $DesignPackRoot $frameRel
    if (-not (Test-Path $path)) {
        Write-Output "SKIP $($Case.id) — missing $frameRel"
        return
    }

    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    Write-Output ""
    Write-Output "=== $($Case.id): $($Case.label) ==="
    Write-Output "  file: $frameRel ($($bmp.Width)x$($bmp.Height))"

    if ($Case.preCropped) {
        $crop = @{ X = 0; Y = 0; Width = $bmp.Width; Height = $bmp.Height }
    }
    else {
        $crop = Get-CropRect $bmp
        if (-not $crop) {
            Write-Output "  FAIL — crop detection failed"
            $bmp.Dispose()
            return
        }
    }

    Write-Output ("  crop: x={0} y={1} w={2} h={3}" -f $crop.X, $crop.Y, $crop.Width, $crop.Height)

    $tabRow = Measure-TabRowBest $bmp $crop.X $crop.Y $crop.Width $crop.Height $Case.layout `
        $Expectations.tabRowHeightRatio $Expectations.tabBottomMarginRatio

    if (-not $tabRow) {
        Write-Output "  FAIL — tab row not found"
        $bmp.Dispose()
        return
    }

    Write-Output ("  tabY={0}px ratio={1} score={2} mode={3}" -f `
        $tabRow.TabY, $tabRow.TabRowRatio, $tabRow.Score, $tabRow.ScanMode)
    Write-Output ("  scrollStart={0}px ratio={1}" -f `
        $tabRow.ScrollStartY, $tabRow.ScrollStartRatio)

    if ($null -ne $Case.legacyHeaderRatio) {
        $legacyPx = [Math]::Floor($crop.Height * $Case.legacyHeaderRatio)
        Write-Output ("  legacyHeader(16%%)={0}px ratio={1} delta={2}px" -f `
            $legacyPx, $Case.legacyHeaderRatio, ($tabRow.ScrollStartY - $legacyPx))
    }

    $expScroll = $Case.scrollStartRatio
    $expTab = $Case.tabRowRatio
    $scrollOk = ($tabRow.ScrollStartRatio -ge $expScroll.min) -and ($tabRow.ScrollStartRatio -le $expScroll.max)
    $tabOk = ($tabRow.TabRowRatio -ge $expTab.min) -and ($tabRow.TabRowRatio -le $expTab.max)

    if ($scrollOk -and $tabOk) {
        Write-Output "  RESULT: PASS (scrollStart + tabRow in expected band)"
    }
    else {
        Write-Output "  RESULT: FAIL"
        if (-not $scrollOk) {
            Write-Output ("    scrollStartRatio {0} not in [{1}, {2}]" -f `
                $tabRow.ScrollStartRatio, $expScroll.min, $expScroll.max)
        }
        if (-not $tabOk) {
            Write-Output ("    tabRowRatio {0} not in [{1}, {2}]" -f `
                $tabRow.TabRowRatio, $expTab.min, $expTab.max)
        }
    }

    $bmp.Dispose()
}

Write-Output "stitch-golden measure-regions (R0)"
Write-Output "designPack: $DesignPackRoot"

if (-not (Test-Path $DesignPackRoot)) {
    Write-Output "ERROR: design pack not found"
    exit 1
}

$cases = @($Expectations.cases)
if ($CaseId) {
    $cases = @($cases | Where-Object { $_.id -eq $CaseId })
    if ($cases.Count -eq 0) {
        Write-Output "ERROR: unknown CaseId $CaseId"
        exit 1
    }
}

foreach ($c in $cases) {
    Test-GoldenCase $c
}

Write-Output ""
Write-Output "Done. See docs/tasks/REQ-stitch-rewrite.md for R1+ implementation."
