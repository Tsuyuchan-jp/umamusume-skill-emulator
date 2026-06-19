/** シミュレーション失敗時のユーザー向け既定メッセージ */
const DEFAULT_SIMULATION_ERROR_MESSAGE =
  "シミュレーションを完了できませんでした。一時的な不具合の可能性があります。もう一度実行してみてください。繰り返す場合はアプリの再読み込みをお試しください。";

/** raceDetail 取得失敗時（sim 集計は成功）のトースト文言 */
export const RACE_DETAIL_FETCH_FAILED_MESSAGE =
  "シミュレーションは完了しましたが、詳細グラフの取得に失敗しました。もう一度実行するか、結果の数値のみご確認ください。";

const INTERNAL_ERROR_PATTERNS = [
  /^null$/i,
  /^undefined$/i,
  /^worker terminated$/i,
  /^\s*$/,
];

function extractErrorMessage(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) return error.message ?? "";
  return String(error);
}

/** Worker / WASM 由来など、ユーザーにそのまま見せない内部メッセージか */
export function isInternalSimulationErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  if (INTERNAL_ERROR_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (trimmed.length === 0) return true;
  // 日本語を含まない内部英語メッセージは正規化対象
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed);
  return !hasJapanese;
}

/** reject / throw 用にエラーを正規化する */
export function toSimulationError(error: unknown): Error {
  const message = extractErrorMessage(error);
  if (message && !isInternalSimulationErrorMessage(message)) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(DEFAULT_SIMULATION_ERROR_MESSAGE);
}

/** トースト表示用の最終文言（プレフィックスなし） */
export function formatSimulationErrorMessage(error: unknown): string {
  return toSimulationError(error).message;
}
