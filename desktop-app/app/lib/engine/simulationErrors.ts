/** スキルデータ取得全滅時のユーザー向け文言 */
export const SKILL_DATA_FETCH_ERROR_MESSAGE =
  "スキルデータの取得に失敗しました。インターネット接続をご確認のうえ、もう一度お試しください。";

/** Worker / WASM 失敗時のユーザー向け文言 */
export const SIMULATION_WORKER_ERROR_MESSAGE =
  "シミュレーション処理中にエラーが発生しました。試行回数を減らすか、アプリを再起動してお試しください。";

/**
 * Worker が "null" / 空メッセージを返したとき（超長距離の連続実行で起きやすい）向け文言。
 * 部分成功集計はせず、全滅時の理由説明に使う。
 */
export const SIMULATION_NULL_ERROR_MESSAGE =
  "超長距離レースの連続シミュレーション中に内部エラーが発生しました。試行回数を減らすか、作戦を変更してお試しください。改善しない場合はアプリを再起動してください。";

/** フォールバック使用時のトースト文言（sim 自体は成功） */
export const SKILL_DATA_FALLBACK_TOAST_MESSAGE =
  "オンライン取得に失敗したため、保存済み／同梱のスキルデータで続行しました（最新版ではない可能性があります）。";

/** raceDetail 取得失敗時（sim 集計は成功）のトースト文言 */
export const RACE_DETAIL_FETCH_FAILED_MESSAGE =
  "シミュレーションは完了しましたが、詳細グラフの取得に失敗しました。もう一度実行するか、結果の数値のみご確認ください。";

/** "null" / 空など、長距離向け専用文言へ寄せるパターン */
const NULLISH_ERROR_PATTERNS = [
  /^null$/i,
  /^undefined$/i,
  /^\s*$/,
];

const INTERNAL_ERROR_PATTERNS = [
  /^null$/i,
  /^undefined$/i,
  /^worker terminated$/i,
  /^\s*$/,
];

/** fetch 全滅（remote + cache + bundled 不可） */
export class SkillDataFetchError extends Error {
  readonly kind = "SKILL_DATA_FETCH" as const;

  constructor(message: string = SKILL_DATA_FETCH_ERROR_MESSAGE) {
    super(message);
    this.name = "SkillDataFetchError";
  }
}

/** Worker / WASM 実行失敗 */
export class SimulationWorkerError extends Error {
  readonly kind = "SIMULATION_WORKER" as const;

  constructor(message: string = SIMULATION_WORKER_ERROR_MESSAGE) {
    super(message);
    this.name = "SimulationWorkerError";
  }
}

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

function isNullishSimulationMessage(message: string): boolean {
  return NULLISH_ERROR_PATTERNS.some((p) => p.test(message.trim()));
}

/** reject / throw 用に Worker エラーを正規化する */
export function toSimulationError(error: unknown): SimulationWorkerError {
  const message = extractErrorMessage(error);
  if (isNullishSimulationMessage(message)) {
    return new SimulationWorkerError(SIMULATION_NULL_ERROR_MESSAGE);
  }
  if (message && !isInternalSimulationErrorMessage(message)) {
    return new SimulationWorkerError(message);
  }
  return new SimulationWorkerError();
}

/** トースト表示用の最終文言（プレフィックスなし） */
export function formatSimulationErrorMessage(error: unknown): string {
  if (error instanceof SkillDataFetchError) {
    return error.message;
  }
  if (error instanceof SimulationWorkerError) {
    return error.message;
  }

  const message = extractErrorMessage(error);
  if (isNullishSimulationMessage(message)) {
    return SIMULATION_NULL_ERROR_MESSAGE;
  }
  if (message && !isInternalSimulationErrorMessage(message)) {
    return message;
  }
  return SIMULATION_WORKER_ERROR_MESSAGE;
}
