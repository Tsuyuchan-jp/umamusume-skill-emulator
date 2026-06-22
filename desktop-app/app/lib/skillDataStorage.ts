/** AppData 配下のスキルデータキャッシュ読み書き（Tauri 環境のみ） */

const SKILL_DATA_SUBDIR = "skill_data";
const SKILL_DATA_FILENAME = "skill_data.txt";

function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

async function getSkillDataFilePath(): Promise<string> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appDataDir(), SKILL_DATA_SUBDIR, SKILL_DATA_FILENAME);
}

/** Tauri AppData からキャッシュを読み込む。非 Tauri または未存在時は null */
export async function readSkillDataCache(): Promise<string | null> {
  if (!isTauriEnvironment()) return null;

  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const filePath = await getSkillDataFilePath();
    return await readTextFile(filePath);
  } catch (error) {
    console.warn("AppData skill data cache not available:", error);
    return null;
  }
}

/** remote 取得成功時のみ AppData に生 JSON テキストを保存 */
export async function writeSkillDataCache(text: string): Promise<void> {
  if (!isTauriEnvironment()) return;

  try {
    const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const dirPath = await join(await appDataDir(), SKILL_DATA_SUBDIR);
    await mkdir(dirPath, { recursive: true });
    const filePath = await join(dirPath, SKILL_DATA_FILENAME);
    await writeTextFile(filePath, text);
  } catch (error) {
    console.warn("Failed to write AppData skill data cache:", error);
  }
}

/** 破損キャッシュを削除（削除失敗は無視） */
export async function removeSkillDataCache(): Promise<void> {
  if (!isTauriEnvironment()) return;

  try {
    const { remove } = await import("@tauri-apps/plugin-fs");
    const filePath = await getSkillDataFilePath();
    await remove(filePath);
  } catch (error) {
    console.warn("Failed to remove corrupted skill data cache:", error);
  }
}
