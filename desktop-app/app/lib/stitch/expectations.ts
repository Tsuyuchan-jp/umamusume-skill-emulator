import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** golden 期待値（tools/stitch-golden/expectations.json と同期） */

export interface RatioBand {
  min: number;
  max: number;
}

export interface GoldenCase {
  id: string;
  label: string;
  layout: "L2" | "L3" | "L3+Btn";
  framePaths: string[];
  scrollStartRatio: RatioBand;
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
