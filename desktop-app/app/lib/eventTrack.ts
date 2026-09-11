import { trackData } from "./trackData";
import type { RaceCondition } from "./types";

export const EVENT_TRACK_URL =
  "https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/event_track.txt";

/** アプリのデフォルトバ場（良）。LoH など 5 列目が無い行で使う */
export const DEFAULT_SURFACE_COND = 1;

const SURFACE_BY_KEY: Record<string, number> = {
  GOOD: 1,
  YAYAOMO: 2,
  OMO: 3,
  BAD: 4,
};

export interface RacePreset extends RaceCondition {
  name: string;
}

/**
 * umasim `event_track.txt` を本アプリのプリセット配列にする。
 * 5 列目が無い行（LoH）はバ場をデフォルト（良）にする。
 */
export function parseEventTrackText(text: string): RacePreset[] {
  const presets: RacePreset[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const data = rawLine.trim().split(",");
    if (data.length < 4) continue;

    const month = data[0];
    const kind = data[1];
    const placeName = data[2];
    const distance = data[3];
    const isLoh = kind === "L";
    const playerNum = isLoh ? 12 : 9;
    const surfaceCond = data[4]
      ? (SURFACE_BY_KEY[data[4]] ?? DEFAULT_SURFACE_COND)
      : DEFAULT_SURFACE_COND;

    const location = trackData.find((loc) => loc.name === placeName);
    if (!location) continue;
    const course = location.courses.find((c) => c.name.startsWith(distance));
    if (!course) continue;

    const kindLabel = isLoh ? "LoH" : "チャンミ";
    presets.push({
      name: `${month}月${kindLabel} ${placeName} ${distance}`,
      locationId: location.id,
      courseId: course.id,
      surfaceCond,
      playerNum,
    });
  }

  return presets;
}

/** 取得失敗・0 件は呼び出し側で空配列として扱う */
export async function fetchEventTrackPresets(): Promise<RacePreset[]> {
  const res = await fetch(EVENT_TRACK_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch event track: HTTP ${res.status}`);
  }
  const presets = parseEventTrackText(await res.text());
  if (presets.length === 0) {
    throw new Error("Event track parsed to empty preset list");
  }
  return presets;
}
