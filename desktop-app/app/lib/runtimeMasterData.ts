import { fetchEventTrackPresets, type RacePreset } from "./eventTrack";
import {
  applyUmasimSkillCatalog,
  type UmasimSkillEntry,
} from "./umasimSkillData";
import { resetCanonicalSkillNameCache } from "./fuzzyMatcher";
import {
  fetchSkillData,
  getLastSkillDataMeta,
  type SkillDataSource,
} from "./engine/umaemuAdapter";
import { SKILL_DATA_FETCH_ERROR_MESSAGE } from "./engine/simulationErrors";
import { skillDataToastForSource } from "./skillDataUi";
import type { RawSkillData } from "./types";

export interface RuntimeMasterResult {
  skillSource: SkillDataSource | null;
  presets: RacePreset[];
  toast: { message: string; type: "success" | "error" };
}

/** 起動時トースト済みなら、シミュ完了時のフォールバックトーストを出さない */
let skillDataToastAnnounced = false;

export function wasSkillDataToastAnnounced(): boolean {
  return skillDataToastAnnounced;
}

export function markSkillDataToastAnnounced(): void {
  skillDataToastAnnounced = true;
}

function toCatalogEntries(data: RawSkillData[]): UmasimSkillEntry[] {
  return data.map((skill) => ({
    name: String(skill.name),
    id: String(skill.id),
    rarity: String(skill.rarity ?? "normal"),
  }));
}

/**
 * シミュ JSON を取得し一覧へ反映。続けて開催ローテを取得する。
 * プリセット失敗は空配列（非表示）。スキル失敗は D トースト。
 */
export async function refreshRuntimeMaster(options?: {
  force?: boolean;
}): Promise<RuntimeMasterResult> {
  try {
    const data = await fetchSkillData({ force: options?.force === true });
    applyUmasimSkillCatalog(toCatalogEntries(data));
    resetCanonicalSkillNameCache();
  } catch (error) {
    console.warn("Runtime skill catalog refresh failed:", error);
    return {
      skillSource: null,
      presets: [],
      toast: { message: SKILL_DATA_FETCH_ERROR_MESSAGE, type: "error" },
    };
  }

  const meta = getLastSkillDataMeta();
  const skillSource = meta?.source ?? "bundled";
  const toast = skillDataToastForSource(skillSource);

  let presets: RacePreset[] = [];
  try {
    presets = await fetchEventTrackPresets();
  } catch (error) {
    console.warn("Event track preset fetch failed:", error);
    presets = [];
  }

  return { skillSource, presets, toast };
}
