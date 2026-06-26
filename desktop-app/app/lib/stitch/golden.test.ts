import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDesignPackRoot,
  getGoldenCase,
  isDesignPackPresent,
  isRatioInBand,
  loadStitchGoldenExpectations,
} from "./expectations";
import { measureLayoutFromFrame, measureScrollStartFromFrames, measureComposeFromFrames, measureShiftFromFrames } from "./goldenMeasure";
import { USE_STITCH_V2 } from "./flags";

describe("stitch golden expectations (R0)", () => {
  it("expectations.json が読み込める", () => {
    const exp = loadStitchGoldenExpectations();
    expect(exp.version).toBe(1);
    expect(exp.cases.length).toBeGreaterThanOrEqual(4);
  });

  it("各ケースに必須フィールドと妥当な比率帯がある", () => {
    const exp = loadStitchGoldenExpectations();
    for (const c of exp.cases) {
      expect(c.id).toMatch(/^G-/);
      expect(["L2", "L3", "L3+Btn"]).toContain(c.layout);
      expect(c.framePaths.length).toBeGreaterThan(0);
      expect(c.scrollStartRatio.min).toBeLessThan(c.scrollStartRatio.max);
      expect(c.tabRowRatio.min).toBeLessThan(c.tabRowRatio.max);
      expect(c.scrollStartRatio.min).toBeGreaterThan(0.1);
      expect(c.scrollStartRatio.max).toBeLessThan(0.6);
    }
  });

  it("HOF の scrollStart 期待帯は旧 16% と一致しない", () => {
    const hof = loadStitchGoldenExpectations().cases.find((c) => c.id === "G-HOF-S");
    expect(hof).toBeDefined();
    expect(hof!.legacyHeaderRatio).toBe(0.16);
    expect(isRatioInBand(0.16, hof!.scrollStartRatio)).toBe(false);
  });

  it("TRN の scrollStart 期待帯は L2（≈50%）付近", () => {
    const trn = loadStitchGoldenExpectations().cases.find((c) => c.id === "G-TRN");
    expect(trn).toBeDefined();
    expect(trn!.layout).toBe("L2");
    expect(trn!.scrollStartRatio.min).toBeGreaterThan(0.45);
  });

  it("USE_STITCH_V2 は R3 で true（stitch オーケストレータ正本）", () => {
    expect(USE_STITCH_V2).toBe(true);
  });
});

describe.skipIf(!isDesignPackPresent())("stitch golden R3 compose smoke (RGBA)", () => {
  const packRoot = getDesignPackRoot();

  it("G-TRN compose: 出力高さ > crop 高さ・overlap 合計 > 0", async () => {
    const c = getGoldenCase("G-TRN")!;
    const framePaths = [
      "golden/TRN/frame_000.png",
      "golden/TRN/frame_001.png",
      "golden/TRN/frame_002.png",
      "golden/TRN/frame_003.png",
    ];
    const measured = await measureComposeFromFrames(packRoot, framePaths, c.layout);
    expect(measured.outputHeight).toBeGreaterThan(measured.crop.height);
    expect(measured.overlapSum).toBeGreaterThan(0);
    expect(measured.frameCount).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("G-HOF-S compose: 出力高さ > crop 高さ・3フレーム結合", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const framePaths = [
      c.framePaths[0],
      "screenshots/HOF/skill/S1-mid.png",
      "screenshots/HOF/skill/S2-bottom.png",
    ];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }
    const measured = await measureComposeFromFrames(packRoot, framePaths, c.layout);
    expect(measured.outputHeight).toBeGreaterThan(measured.crop.height);
    expect(measured.overlapSum).toBeGreaterThan(100);
    expect(measured.frameCount).toBe(3);
  }, 60_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden R3.5a shiftEstimate", () => {
  const packRoot = getDesignPackRoot();

  function stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  it("G-FRD-S frame_000..007: std(S_k)<20, min(S_k)>80, [22,32] 禁止帯 0件", async () => {
    const c = getGoldenCase("G-FRD-S")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/skill/frame_${String(i).padStart(3, "0")}.png`
    );
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    const overlaps = measured.overlaps;
    expect(overlaps.length).toBeGreaterThanOrEqual(6);

    const sStd = stdDev(overlaps);
    expect(sStd, `std(S_k)=${sStd.toFixed(2)} overlaps=${overlaps.join(",")}`).toBeLessThan(20);
    expect(Math.min(...overlaps), `min(S_k)=${Math.min(...overlaps)}`).toBeGreaterThan(80);

    const forbidden = overlaps.filter((s) => s >= 22 && s <= 32);
    expect(
      forbidden.length,
      `26px 禁止帯ヒット: ${forbidden.join(",")}`
    ).toBe(0);
  }, 120_000);

  it("G-HOF-S 3フレーム: median(S*)∈[200,280]", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const framePaths = [
      c.framePaths[0],
      "screenshots/HOF/skill/S1-mid.png",
      "screenshots/HOF/skill/S2-bottom.png",
    ];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    expect(
      measured.representative,
      `S*=${measured.representative} overlaps=${measured.overlaps.join(",")}`
    ).toBeGreaterThanOrEqual(200);
    expect(measured.representative).toBeLessThanOrEqual(280);
  }, 60_000);

  it("G-FRD-S compose: overlapSum>700, outputHeight>1300", async () => {
    const c = getGoldenCase("G-FRD-S")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/skill/frame_${String(i).padStart(3, "0")}.png`
    );

    const measured = await measureComposeFromFrames(packRoot, framePaths, c.layout);
    expect(
      measured.overlapSum,
      `overlapSum=${measured.overlapSum}`
    ).toBeGreaterThan(700);
    expect(
      measured.outputHeight,
      `outputHeight=${measured.outputHeight}`
    ).toBeGreaterThan(1300);
  }, 120_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden design pack paths", () => {
  const packRoot = getDesignPackRoot();

  it("設計パックの golden フレームパスが存在する", () => {
    const exp = loadStitchGoldenExpectations();
    const missing: string[] = [];
    for (const c of exp.cases) {
      for (const rel of c.framePaths) {
        const full = join(packRoot, rel.replace(/\//g, "\\"));
        const fullAlt = join(packRoot, rel);
        if (!existsSync(full) && !existsSync(fullAlt)) {
          missing.push(`${c.id}: ${rel}`);
        }
      }
    }
    expect(missing, `missing frames:\n${missing.join("\n")}`).toEqual([]);
  });
});

describe.skipIf(!isDesignPackPresent())("stitch golden R1 scrollStartRatio (absdiff)", () => {
  const packRoot = getDesignPackRoot();

  it("G-TRN scrollStartRatio ∈ [0.48, 0.54]", async () => {
    const c = getGoldenCase("G-TRN")!;
    expect(c.framePaths.length).toBeGreaterThanOrEqual(2);
    const measured = await measureScrollStartFromFrames(
      packRoot,
      c.framePaths,
      c.layout
    );
    expect(
      isRatioInBand(measured.scrollStartRatio, c.scrollStartRatio),
      `ratio=${measured.scrollStartRatio.toFixed(4)} method=${measured.method}`
    ).toBe(true);
  }, 60_000);

  it("G-HOF-S scrollStartRatio ∈ [0.36, 0.46]", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const framePaths = [c.framePaths[0], "screenshots/HOF/skill/S1-mid.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const measured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(measured.scrollStartRatio, c.scrollStartRatio),
      `ratio=${measured.scrollStartRatio.toFixed(4)} method=${measured.method}`
    ).toBe(true);
  }, 60_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden R3.5b layout + tabDetect", () => {
  const packRoot = getDesignPackRoot();

  it("G-TRN: layout=L2, tabRowRatio∈[0.44,0.50], tab=Skill", async () => {
    const c = getGoldenCase("G-TRN")!;
    const framePath = c.framePaths[0]!;

    const measured = await measureLayoutFromFrame(packRoot, framePath);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L2");
    expect(
      measured.tabRowRatio,
      `tabRowRatio=${measured.tabRowRatio.toFixed(4)} method=${measured.tabRowMethod}`
    ).toBeGreaterThanOrEqual(0.44);
    expect(measured.tabRowRatio).toBeLessThanOrEqual(0.5);
    expect(measured.tab, `tab=${measured.tab}`).toBe("Skill");
  }, 60_000);

  it("G-HOF-S: layout=L3（退行ゲート）", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const measured = await measureLayoutFromFrame(packRoot, c.framePaths[0]!);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L3");
  }, 60_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden R2 layout + scrollStartRatio", () => {
  const packRoot = getDesignPackRoot();

  it("G-CMP-S layout=L3, tabRowRatio∈[0.33,0.43], scrollStartRatio∈[0.36,0.46]", async () => {
    const c = getGoldenCase("G-CMP-S")!;
    const framePaths = [c.framePaths[0], "screenshots/CMP/skill/S1-mid.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.tabRowRatio),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod}`
    ).toBe(true);

    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.scrollStartRatio),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method}`
    ).toBe(true);
  }, 60_000);

  it("G-FRD-S layout=L3+Btn, tabRowRatio∈[0.39,0.47], scrollStartRatio∈[0.52,0.56]", async () => {
    const c = getGoldenCase("G-FRD-S")!;
    const framePaths = [c.framePaths[0], "golden/FRD/skill/frame_001.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3+Btn");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.tabRowRatio),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod}`
    ).toBe(true);

    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.scrollStartRatio),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method}`
    ).toBe(true);
    expect(scrollMeasured.method, "G-FRD-S scrollStart は absdiff 主経路").toBe("absdiff");
  }, 60_000);
});
