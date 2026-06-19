import { describe, expect, it } from "vitest";
import {
  formatSimulationErrorMessage,
  isInternalSimulationErrorMessage,
  toSimulationError,
} from "./simulationErrors";

describe("simulationErrors", () => {
  it("null / 空 / Worker terminated を既定の日本語メッセージに正規化する", () => {
    expect(formatSimulationErrorMessage(null)).toMatch(/シミュレーションを完了できませんでした/);
    expect(formatSimulationErrorMessage(new Error("null"))).toMatch(/シミュレーションを完了できませんでした/);
    expect(formatSimulationErrorMessage(new Error("Worker terminated"))).toMatch(
      /シミュレーションを完了できませんでした/
    );
    expect(formatSimulationErrorMessage(new Error(""))).toMatch(/シミュレーションを完了できませんでした/);
  });

  it("日本語を含むメッセージはそのまま返す", () => {
    const msg = "作戦が未選択です";
    expect(formatSimulationErrorMessage(new Error(msg))).toBe(msg);
  });

  it("内部英語メッセージは正規化する", () => {
    expect(isInternalSimulationErrorMessage("OOM")).toBe(true);
    expect(toSimulationError(new Error("OOM")).message).toMatch(/シミュレーションを完了できませんでした/);
  });
});
