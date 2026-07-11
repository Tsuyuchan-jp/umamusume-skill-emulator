import { describe, expect, it } from "vitest";
import {
  formatSimulationErrorMessage,
  isInternalSimulationErrorMessage,
  toSimulationError,
  SkillDataFetchError,
  SimulationWorkerError,
  SKILL_DATA_FETCH_ERROR_MESSAGE,
  SIMULATION_WORKER_ERROR_MESSAGE,
  SIMULATION_NULL_ERROR_MESSAGE,
} from "./simulationErrors";

describe("simulationErrors", () => {
  it("SkillDataFetchError は専用の日本語メッセージを返す", () => {
    expect(formatSimulationErrorMessage(new SkillDataFetchError())).toBe(
      SKILL_DATA_FETCH_ERROR_MESSAGE
    );
  });

  it("SimulationWorkerError は専用の日本語メッセージを返す", () => {
    expect(formatSimulationErrorMessage(new SimulationWorkerError())).toBe(
      SIMULATION_WORKER_ERROR_MESSAGE
    );
  });

  it("null / 空メッセージは長距離向け日本語に正規化する", () => {
    expect(formatSimulationErrorMessage(null)).toBe(SIMULATION_NULL_ERROR_MESSAGE);
    expect(formatSimulationErrorMessage(new Error("null"))).toBe(
      SIMULATION_NULL_ERROR_MESSAGE
    );
    expect(formatSimulationErrorMessage(new Error(""))).toBe(
      SIMULATION_NULL_ERROR_MESSAGE
    );
    expect(toSimulationError(new Error("null")).message).toBe(
      SIMULATION_NULL_ERROR_MESSAGE
    );
    expect(toSimulationError("null").message).toBe(SIMULATION_NULL_ERROR_MESSAGE);
  });

  it("Worker terminated は汎用 SIMULATION_WORKER 文言に正規化する", () => {
    expect(formatSimulationErrorMessage(new Error("Worker terminated"))).toBe(
      SIMULATION_WORKER_ERROR_MESSAGE
    );
  });

  it("日本語を含むメッセージはそのまま返す", () => {
    const msg = "作戦が未選択です";
    expect(formatSimulationErrorMessage(new Error(msg))).toBe(msg);
  });

  it("内部英語メッセージは SIMULATION_WORKER 文言に正規化する", () => {
    expect(isInternalSimulationErrorMessage("OOM")).toBe(true);
    expect(toSimulationError(new Error("OOM")).message).toBe(
      SIMULATION_WORKER_ERROR_MESSAGE
    );
    expect(toSimulationError(new Error("Failed to fetch"))).toBeInstanceOf(
      SimulationWorkerError
    );
  });

  it("fetch 全滅と Worker 失敗で異なる文言になる", () => {
    const fetchMsg = formatSimulationErrorMessage(new SkillDataFetchError());
    const workerMsg = formatSimulationErrorMessage(new SimulationWorkerError());
    expect(fetchMsg).not.toBe(workerMsg);
    expect(fetchMsg).toMatch(/スキルデータの取得に失敗/);
    expect(workerMsg).toMatch(/シミュレーション処理中にエラー/);
  });

  it("null 文言と汎用 Worker 文言は異なる", () => {
    expect(SIMULATION_NULL_ERROR_MESSAGE).not.toBe(SIMULATION_WORKER_ERROR_MESSAGE);
    expect(SIMULATION_NULL_ERROR_MESSAGE).toMatch(/超長距離/);
  });
});
