import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** golden 期待値（tools/stitch-golden/expectations.json と同期） */

export interface RatioBand {
  min: number;
  max: number;
}

export type PartnerBandVariant = "absent" | "register" | "release";

/** Scene Spec 期待帯（expectations.json sceneSpec が正本。M3+） */
export interface SceneSpecExpectations {
  partnerBand: { variant: PartnerBandVariant };
  tabRow: RatioBand;
  scrollStart: RatioBand;
  /** INV-3: scrollRegionH 帯から導出（狭帯 -3 / 広帯 -4） */
  wheel: -3 | -4;
}

export interface GoldenCase {
  id: string;
  label: string;
  layout: "L2" | "L3" | "L3+Btn";
  framePaths: string[];
  /** Scene Spec 名付き期待（正本）。scrollStartRatio/tabRowRatio は移行期互換 */
  sceneSpec: SceneSpecExpectations;
  /** @deprecated sceneSpec.scrollStart を参照。同期検証のみ */
  scrollStartRatio: RatioBand;
  /** @deprecated sceneSpec.tabRow を参照。同期検証のみ */
  tabRowRatio: RatioBand;
  legacyHeaderRatio: number | null;
  /** R3.5c: セッション代表 shift S*（ホイール -4 正本） */
  shiftRepresentative?: RatioBand;
  notes?: string;
}

export interface StitchGoldenExpectations {
  version: number;
  description: string;
  designPackRoot: string;
  footerRatio: number;
  tabRowHeightRatio: number;
  tabBottomMarginRatio: number;
  cases: GoldenCase[];
}

const PARTNER_VARIANTS: PartnerBandVariant[] = ["absent", "register", "release"];
const WHEEL_VALUES = [-3, -4] as const;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const expectationsPath = join(repoRoot, "tools/stitch-golden/expectations.json");

export function loadStitchGoldenExpectations(): StitchGoldenExpectations {
  const raw = readFileSync(expectationsPath, "utf8");
  return JSON.parse(raw) as StitchGoldenExpectations;
}

export function getDesignPackRoot(): string {
  const exp = loadStitchGoldenExpectations();
  return join(repoRoot, exp.designPackRoot);
}

export function isDesignPackPresent(): boolean {
  return existsSync(getDesignPackRoot());
}

export function getGoldenCase(id: string): GoldenCase | undefined {
  return loadStitchGoldenExpectations().cases.find((c) => c.id === id);
}

export function isRatioInBand(value: number, band: RatioBand): boolean {
  return value >= band.min && value <= band.max;
}

/** 2 つの比率帯が完全一致するか（移行期 sync 検証） */
export function bandsEqual(a: RatioBand, b: RatioBand): boolean {
  return a.min === b.min && a.max === b.max;
}

function isValidRatioBand(band: RatioBand | undefined): band is RatioBand {
  return (
    band != null &&
    typeof band.min === "number" &&
    typeof band.max === "number" &&
    band.min < band.max
  );
}

/** 単一 case の sceneSpec スキーマ・同期・INV-1 メタ検証。エラー文字列の配列を返す */
export function validateGoldenCaseSceneSpec(
  c: GoldenCase,
  tabBottomMarginRatio: number
): string[] {
  const errors: string[] = [];
  const spec = c.sceneSpec;

  if (!spec) {
    errors.push(`${c.id}: sceneSpec 必須`);
    return errors;
  }

  if (!PARTNER_VARIANTS.includes(spec.partnerBand?.variant)) {
    errors.push(`${c.id}: partnerBand.variant が不正 (${String(spec.partnerBand?.variant)})`);
  }

  if (!isValidRatioBand(spec.tabRow)) {
    errors.push(`${c.id}: sceneSpec.tabRow の min/max が不正`);
  }
  if (!isValidRatioBand(spec.scrollStart)) {
    errors.push(`${c.id}: sceneSpec.scrollStart の min/max が不正`);
  }

  if (!WHEEL_VALUES.includes(spec.wheel)) {
    errors.push(`${c.id}: sceneSpec.wheel は -3 または -4 (${String(spec.wheel)})`);
  }

  if (!bandsEqual(c.scrollStartRatio, spec.scrollStart)) {
    errors.push(
      `${c.id}: scrollStartRatio と sceneSpec.scrollStart が不一致 ` +
        `(legacy ${c.scrollStartRatio.min}-${c.scrollStartRatio.max} vs spec ${spec.scrollStart.min}-${spec.scrollStart.max})`
    );
  }
  if (!bandsEqual(c.tabRowRatio, spec.tabRow)) {
    errors.push(
      `${c.id}: tabRowRatio と sceneSpec.tabRow が不一致 ` +
        `(legacy ${c.tabRowRatio.min}-${c.tabRowRatio.max} vs spec ${spec.tabRow.min}-${spec.tabRow.max})`
    );
  }

  return errors;
}

/** sceneSpec 帯が INV-1（scrollStart.min > tabRow.max + margin）を満たすか — タイト帯 case 用 */
export function satisfiesInv1SpecBands(
  spec: SceneSpecExpectations,
  tabBottomMarginRatio: number
): boolean {
  return spec.scrollStart.min > spec.tabRow.max + tabBottomMarginRatio;
}

/** 全 case の sceneSpec 検証。Vitest R0 スキーマゲート用 */
export function validateAllGoldenCaseSceneSpecs(exp: StitchGoldenExpectations): string[] {
  return exp.cases.flatMap((c) => validateGoldenCaseSceneSpec(c, exp.tabBottomMarginRatio));
}

/** 計測値が INV-1（scrollStart > tabRow + margin）を満たすか */
export function satisfiesInv1Measured(
  tabRowRatio: number,
  scrollStartRatio: number,
  tabBottomMarginRatio: number
): boolean {
  return scrollStartRatio > tabRowRatio + tabBottomMarginRatio;
}
