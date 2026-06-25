import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDesignPackRoot,
  isDesignPackPresent,
  isRatioInBand,
  loadStitchGoldenExpectations,
} from "./expectations";

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
