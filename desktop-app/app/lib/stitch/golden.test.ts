import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDesignPackRoot,
  getGoldenCase,
  isDesignPackPresent,
  isRatioInBand,
  loadStitchGoldenExpectations,
  satisfiesInv1Measured,
  satisfiesInv1SpecBands,
  validateAllGoldenCaseSceneSpecs,
} from "./expectations";
import { measureLayoutFromFrame, measureScrollStartFromFrames, measureComposeFromFrames, measureShiftFromFrames } from "./goldenMeasure";
import { USE_STITCH_V2 } from "./flags";

describe("stitch golden expectations (R0)", () => {
  it("expectations.json が読み込める", () => {
    const exp = loadStitchGoldenExpectations();
    expect(exp.version).toBe(1);
    expect(exp.cases.length).toBe(8);
  });

  it("全8 case: sceneSpec 必須・スキーマ・legacy 同期", () => {
    const exp = loadStitchGoldenExpectations();
    const errors = validateAllGoldenCaseSceneSpecs(exp);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  it("各ケースに必須フィールドと妥当な sceneSpec 比率帯がある", () => {
    const exp = loadStitchGoldenExpectations();
    for (const c of exp.cases) {
      expect(c.id).toMatch(/^G-/);
      expect(["L2", "L3", "L3+Btn"]).toContain(c.layout);
      expect(c.framePaths.length).toBeGreaterThan(0);
      expect(c.sceneSpec).toBeDefined();
      expect(c.sceneSpec.tabRow.min).toBeLessThan(c.sceneSpec.tabRow.max);
      expect(c.sceneSpec.scrollStart.min).toBeLessThan(c.sceneSpec.scrollStart.max);
      expect(c.sceneSpec.scrollStart.min).toBeGreaterThan(0.1);
      expect(c.sceneSpec.scrollStart.max).toBeLessThan(0.6);
      expect([-3, -4]).toContain(c.sceneSpec.wheel);
    }
  });

  it("FRD スキルタブ（register/release）の sceneSpec 帯は INV-1 メタを満たす", () => {
    const exp = loadStitchGoldenExpectations();
    for (const id of ["G-FRD-S-release", "G-FRD-S-register"]) {
      const c = exp.cases.find((x) => x.id === id);
      expect(c, id).toBeDefined();
      expect(
        satisfiesInv1SpecBands(c!.sceneSpec, exp.tabBottomMarginRatio),
        `${id}: scrollStart.min=${c!.sceneSpec.scrollStart.min} tabRow.max=${c!.sceneSpec.tabRow.max}`
      ).toBe(true);
    }
  });

  it("HOF の scrollStart 期待帯は旧 16% と一致しない", () => {
    const hof = getGoldenCase("G-HOF-S")!;
    expect(hof.legacyHeaderRatio).toBe(0.16);
    expect(isRatioInBand(0.16, hof.sceneSpec.scrollStart)).toBe(false);
  });

  it("TRN の scrollStart 期待帯は L2（≈50%）付近", () => {
    const trn = getGoldenCase("G-TRN")!;
    expect(trn.layout).toBe("L2");
    expect(trn.sceneSpec.scrollStart.min).toBeGreaterThan(0.45);
    expect(trn.sceneSpec.wheel).toBe(-4);
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
      "golden/HOF/skill/frame_001.png",
      "golden/HOF/skill/frame_002.png",
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

  it("G-TRN 4フレーム: median(S*)∈[175,210]・最終ペア bound なし", async () => {
    const c = getGoldenCase("G-TRN")!;
    expect(c.shiftRepresentative).toBeDefined();
    const framePaths = [
      "golden/TRN/frame_000.png",
      "golden/TRN/frame_001.png",
      "golden/TRN/frame_002.png",
      "golden/TRN/frame_003.png",
    ];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    expect(
      measured.representative,
      `S*=${measured.representative} overlaps=${measured.overlaps.join(",")}`
    ).toBeGreaterThanOrEqual(c.shiftRepresentative!.min);
    expect(measured.representative).toBeLessThanOrEqual(c.shiftRepresentative!.max);
    expect(
      measured.overlaps.length,
      `bound により最終フレーム欠落 overlaps=${measured.overlaps.join(",")}`
    ).toBe(framePaths.length - 1);
  }, 60_000);

  it("G-FRD-S-release frame_000..007: std(S_k)<20, min(S_k)>80, [22,32] 禁止帯 0件", async () => {
    const c = getGoldenCase("G-FRD-S-release")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/skill-release/frame_${String(i).padStart(3, "0")}.png`
    );
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    const overlaps = measured.overlaps;
    expect(overlaps.length).toBeGreaterThanOrEqual(6);

    if (c.shiftRepresentative) {
      expect(
        measured.representative,
        `S*=${measured.representative} overlaps=${overlaps.join(",")}`
      ).toBeGreaterThanOrEqual(c.shiftRepresentative.min);
      expect(measured.representative).toBeLessThanOrEqual(c.shiftRepresentative.max);
    }

    const sStd = stdDev(overlaps);
    expect(sStd).toBeLessThan(20);
    expect(Math.min(...overlaps), `min(S_k)=${Math.min(...overlaps)}`).toBeGreaterThan(80);

    const forbidden = overlaps.filter((s) => s >= 22 && s <= 32);
    expect(
      forbidden.length,
      `26px 禁止帯ヒット: ${forbidden.join(",")}`
    ).toBe(0);
  }, 120_000);

  it("G-HOF-S 3フレーム: median(S*)∈期待帯（設計パック退行ゲート）", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    expect(c.shiftRepresentative).toBeDefined();
    const framePaths = [
      c.framePaths[0],
      "golden/HOF/skill/frame_001.png",
      "golden/HOF/skill/frame_002.png",
    ];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    expect(
      measured.representative,
      `S*=${measured.representative} overlaps=${measured.overlaps.join(",")}`
    ).toBeGreaterThanOrEqual(c.shiftRepresentative!.min);
    expect(measured.representative).toBeLessThanOrEqual(c.shiftRepresentative!.max);
  }, 60_000);

  it("G-FRD-S-release compose: overlapSum>700, outputHeight>1300", async () => {
    const c = getGoldenCase("G-FRD-S-release")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/skill-release/frame_${String(i).padStart(3, "0")}.png`
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

  it("G-FRD-I frame_000..007: std(S_k)<25, min(S_k)>80, [22,32] 禁止帯 0件", async () => {
    const c = getGoldenCase("G-FRD-I")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/info/frame_${String(i).padStart(3, "0")}.png`
    );
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const measured = await measureShiftFromFrames(packRoot, framePaths, c.layout);
    const overlaps = measured.overlaps;
    expect(overlaps.length).toBeGreaterThanOrEqual(6);

    if (c.shiftRepresentative) {
      expect(
        measured.representative,
        `S*=${measured.representative} overlaps=${overlaps.join(",")}`
      ).toBeGreaterThanOrEqual(c.shiftRepresentative.min);
      expect(measured.representative).toBeLessThanOrEqual(c.shiftRepresentative.max);
    }

    const sStd = stdDev(overlaps);
    // terminal 末端ペア（144→84）で std≈21。release 同型 <20 では不足のため <25
    expect(sStd).toBeLessThan(25);
    expect(Math.min(...overlaps), `min(S_k)=${Math.min(...overlaps)}`).toBeGreaterThan(80);

    const forbidden = overlaps.filter((s) => s >= 22 && s <= 32);
    expect(
      forbidden.length,
      `26px 禁止帯ヒット: ${forbidden.join(",")}`
    ).toBe(0);
  }, 120_000);

  it("G-FRD-I compose: overlapSum>700, outputHeight>1300", async () => {
    const c = getGoldenCase("G-FRD-I")!;
    const framePaths = Array.from({ length: 8 }, (_, i) =>
      `golden/FRD/info/frame_${String(i).padStart(3, "0")}.png`
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

describe.skipIf(!isDesignPackPresent())("stitch golden R1 scrollStart (absdiff, sceneSpec 正本)", () => {
  const packRoot = getDesignPackRoot();
  const exp = loadStitchGoldenExpectations();

  it("G-TRN scrollStart ∈ sceneSpec.scrollStart", async () => {
    const c = getGoldenCase("G-TRN")!;
    expect(c.framePaths.length).toBeGreaterThanOrEqual(2);
    const measured = await measureScrollStartFromFrames(
      packRoot,
      c.framePaths,
      c.layout
    );
    expect(
      isRatioInBand(measured.scrollStartRatio, c.sceneSpec.scrollStart),
      `ratio=${measured.scrollStartRatio.toFixed(4)} method=${measured.method} band=${c.sceneSpec.scrollStart.min}-${c.sceneSpec.scrollStart.max}`
    ).toBe(true);
    expect(
      satisfiesInv1Measured(
        c.sceneSpec.tabRow.max,
        measured.scrollStartRatio,
        exp.tabBottomMarginRatio
      ),
      `INV-1: scrollStart=${measured.scrollStartRatio.toFixed(4)} tabRow.max=${c.sceneSpec.tabRow.max}`
    ).toBe(true);
  }, 60_000);

  it("G-HOF-S scrollStart ∈ sceneSpec.scrollStart", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const framePaths = [c.framePaths[0], "golden/HOF/skill/frame_001.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const measured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(measured.scrollStartRatio, c.sceneSpec.scrollStart),
      `ratio=${measured.scrollStartRatio.toFixed(4)} method=${measured.method}`
    ).toBe(true);
  }, 60_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden R3.5b layout + tabDetect (sceneSpec 正本)", () => {
  const packRoot = getDesignPackRoot();

  it("G-TRN: layout=L2, tabRow∈sceneSpec.tabRow, tab=Skill", async () => {
    const c = getGoldenCase("G-TRN")!;
    const framePath = c.framePaths[0]!;
    const { tabRow } = c.sceneSpec;

    const measured = await measureLayoutFromFrame(packRoot, framePath);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L2");
    expect(
      isRatioInBand(measured.tabRowRatio, tabRow),
      `tabRowRatio=${measured.tabRowRatio.toFixed(4)} method=${measured.tabRowMethod} band=${tabRow.min}-${tabRow.max}`
    ).toBe(true);
    expect(measured.tab, `tab=${measured.tab}`).toBe("Skill");
  }, 60_000);

  it("G-HOF-S: layout=L3（退行ゲート）", async () => {
    const c = getGoldenCase("G-HOF-S")!;
    const measured = await measureLayoutFromFrame(packRoot, c.framePaths[0]!);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L3");
  }, 60_000);

  it("G-FRD-S-register: tab=Skill（INV-2 アクティブタブ・register 除外）", async () => {
    const c = getGoldenCase("G-FRD-S-register")!;
    const measured = await measureLayoutFromFrame(packRoot, c.framePaths[0]!);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L3+Btn");
    expect(measured.tab, `tab=${measured.tab}`).toBe("Skill");
  }, 60_000);

  it("G-FRD-F: tab=Inheritance（継承タブ・弱優勢再判定）", async () => {
    const c = getGoldenCase("G-FRD-F")!;
    const measured = await measureLayoutFromFrame(packRoot, c.framePaths[0]!);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L3+Btn");
    expect(measured.tab, `tab=${measured.tab}`).toBe("Inheritance");
  }, 60_000);

  it("G-FRD-I: tab=TrainingInfo（育成情報タブ・S-6 経路）", async () => {
    const c = getGoldenCase("G-FRD-I")!;
    const measured = await measureLayoutFromFrame(packRoot, c.framePaths[0]!);
    expect(measured.layout, `layout=${measured.layout}`).toBe("L3+Btn");
    expect(measured.tab, `tab=${measured.tab}`).toBe("TrainingInfo");
  }, 60_000);
});

describe.skipIf(!isDesignPackPresent())("stitch golden R2 layout + scrollStart (sceneSpec 正本)", () => {
  const packRoot = getDesignPackRoot();
  const exp = loadStitchGoldenExpectations();

  it("G-CMP-S layout=L3, tabRow/scrollStart ∈ sceneSpec", async () => {
    const c = getGoldenCase("G-CMP-S")!;
    const framePaths = [c.framePaths[0], "golden/CMP/skill/frame_001.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.sceneSpec.tabRow),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod}`
    ).toBe(true);

    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.sceneSpec.scrollStart),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method}`
    ).toBe(true);
  }, 60_000);

  it("G-FRD-S-release layout=L3+Btn, tabRow/scrollStart ∈ sceneSpec", async () => {
    const c = getGoldenCase("G-FRD-S-release")!;
    const framePaths = [c.framePaths[0], "golden/FRD/skill-release/frame_001.png"];
    const secondPath = join(packRoot, framePaths[1]);
    expect(existsSync(secondPath), `missing ${framePaths[1]}`).toBe(true);

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3+Btn");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.sceneSpec.tabRow),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod}`
    ).toBe(true);

    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.sceneSpec.scrollStart),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method}`
    ).toBe(true);
    expect(scrollMeasured.method, "G-FRD-S-release scrollStart は absdiff 主経路").toBe("absdiff");
    expect(
      satisfiesInv1Measured(
        layoutMeasured.tabRowRatio,
        scrollMeasured.scrollStartRatio,
        exp.tabBottomMarginRatio
      ),
      `INV-1: tabY=${layoutMeasured.tabRowRatio.toFixed(4)} scrollStart=${scrollMeasured.scrollStartRatio.toFixed(4)}`
    ).toBe(true);
  }, 60_000);

  it("G-FRD-S-register layout=L3+Btn（golden 収録ゲート）", async () => {
    const c = getGoldenCase("G-FRD-S-register")!;
    const framePath = c.framePaths[0]!;
    expect(existsSync(join(packRoot, framePath)), `missing ${framePath}`).toBe(true);

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePath);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3+Btn");
    expect(c.sceneSpec.partnerBand.variant).toBe("register");
    expect(c.sceneSpec.wheel).toBe(-3);
  }, 60_000);

  it("G-FRD-S-register tabRow Scene Spec 帯（INV-2）", async () => {
    const c = getGoldenCase("G-FRD-S-register")!;
    const framePath = c.framePaths[0]!;

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePath);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3+Btn");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.sceneSpec.tabRow),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod} band=${c.sceneSpec.tabRow.min}-${c.sceneSpec.tabRow.max}`
    ).toBe(true);
  }, 60_000);

  it("G-FRD-S-register scrollStart ∈ sceneSpec.scrollStart（INV-1）", async () => {
    const c = getGoldenCase("G-FRD-S-register")!;
    const framePaths = [c.framePaths[0]!, c.framePaths[1]!];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]!);
    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.sceneSpec.scrollStart),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method} band=${c.sceneSpec.scrollStart.min}-${c.sceneSpec.scrollStart.max}`
    ).toBe(true);
    expect(
      satisfiesInv1Measured(
        layoutMeasured.tabRowRatio,
        scrollMeasured.scrollStartRatio,
        exp.tabBottomMarginRatio
      ),
      `INV-1: tabY=${layoutMeasured.tabRowRatio.toFixed(4)} scrollStart=${scrollMeasured.scrollStartRatio.toFixed(4)}`
    ).toBe(true);
  }, 60_000);

  it("G-FRD-I layout=L3+Btn, tabRow/scrollStart ∈ sceneSpec（INV-2/INV-1）", async () => {
    const c = getGoldenCase("G-FRD-I")!;
    const framePaths = [c.framePaths[0]!, c.framePaths[1]!];
    for (const rel of framePaths) {
      expect(existsSync(join(packRoot, rel)), `missing ${rel}`).toBe(true);
    }

    const layoutMeasured = await measureLayoutFromFrame(packRoot, framePaths[0]!);
    expect(layoutMeasured.layout, `layout=${layoutMeasured.layout}`).toBe("L3+Btn");
    expect(
      isRatioInBand(layoutMeasured.tabRowRatio, c.sceneSpec.tabRow),
      `tabRowRatio=${layoutMeasured.tabRowRatio.toFixed(4)} method=${layoutMeasured.tabRowMethod} band=${c.sceneSpec.tabRow.min}-${c.sceneSpec.tabRow.max}`
    ).toBe(true);

    const scrollMeasured = await measureScrollStartFromFrames(
      packRoot,
      framePaths,
      c.layout
    );
    expect(
      isRatioInBand(scrollMeasured.scrollStartRatio, c.sceneSpec.scrollStart),
      `scrollStartRatio=${scrollMeasured.scrollStartRatio.toFixed(4)} method=${scrollMeasured.method} band=${c.sceneSpec.scrollStart.min}-${c.sceneSpec.scrollStart.max}`
    ).toBe(true);
    expect(
      satisfiesInv1Measured(
        layoutMeasured.tabRowRatio,
        scrollMeasured.scrollStartRatio,
        exp.tabBottomMarginRatio
      ),
      `INV-1: tabY=${layoutMeasured.tabRowRatio.toFixed(4)} scrollStart=${scrollMeasured.scrollStartRatio.toFixed(4)}`
    ).toBe(true);
  }, 60_000);
});
