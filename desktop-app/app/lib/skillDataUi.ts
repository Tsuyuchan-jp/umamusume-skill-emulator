import type { SkillDataSource } from "./engine/umaemuAdapter";

/** A: umasim から取れた */
export const SKILL_DATA_REMOTE_TOAST_MESSAGE =
  "スキルデータを最新版（umasim）に更新しました";

/** B: オンライン失敗 → 保存済み */
export const SKILL_DATA_CACHE_FALLBACK_TOAST_MESSAGE =
  "オンライン取得に失敗したため、保存済み／同梱のスキルデータで続行しました（最新版ではない可能性があります）。";

/** C: オンライン失敗 → exe 同梱 */
export const SKILL_DATA_BUNDLED_FALLBACK_TOAST_MESSAGE =
  "オンライン取得に失敗したため、アプリ同梱のスキルデータで続行しました（最新版ではない可能性があります）。";

export const SKILL_DATA_STATUS_REMOTE =
  "スキルデータは最新版（umasim）です。OCR・パレット・シミュレーションで同じデータを使っています。";

export const SKILL_DATA_STATUS_CACHE =
  "オンライン取得はできませんでしたが、保存済みのスキルデータで動作しています（最新版ではない可能性があります）。";

export const SKILL_DATA_STATUS_BUNDLED =
  "オンライン取得はできませんでしたが、アプリ同梱のスキルデータで動作しています（最新版ではない可能性があります）。";

export const SKILL_DATA_STATUS_NONE =
  "スキルデータはまだ取得できていません。";

export const SKILL_DATA_STATUS_LOADING = "確認中…";

export function skillDataToastForSource(
  source: SkillDataSource
): { message: string; type: "success" | "error" } {
  switch (source) {
    case "remote":
      return { message: SKILL_DATA_REMOTE_TOAST_MESSAGE, type: "success" };
    case "cache":
      return { message: SKILL_DATA_CACHE_FALLBACK_TOAST_MESSAGE, type: "error" };
    case "bundled":
      return { message: SKILL_DATA_BUNDLED_FALLBACK_TOAST_MESSAGE, type: "error" };
  }
}

export function skillDataStatusText(
  source: SkillDataSource | null,
  loading: boolean
): string {
  if (loading) return SKILL_DATA_STATUS_LOADING;
  if (source == null) return SKILL_DATA_STATUS_NONE;
  switch (source) {
    case "remote":
      return SKILL_DATA_STATUS_REMOTE;
    case "cache":
      return SKILL_DATA_STATUS_CACHE;
    case "bundled":
      return SKILL_DATA_STATUS_BUNDLED;
  }
}

export function eventPresetStatusText(count: number): string {
  if (count > 0) {
    return `イベントプリセットを ${count} 件取得しました。`;
  }
  return "イベントプリセットは取得できませんでした（ボタンは表示しません）。";
}
