import { invoke } from "@tauri-apps/api/core";

const LOCAL_STORAGE_KEY = "geminiApiKey";

/** Windows Credential Manager から API キーを読み込む */
export async function loadApiKey(): Promise<string | null> {
  return invoke<string | null>("get_gemini_api_key");
}

/** Windows Credential Manager に API キーを保存する */
export async function saveApiKey(key: string): Promise<void> {
  await invoke("set_gemini_api_key", { key });
}

/** Credential Manager に API キーが保存されているか確認する */
export async function hasApiKey(): Promise<boolean> {
  return invoke<boolean>("has_gemini_api_key");
}

/**
 * 起動時の移行処理:
 * 1. Credential Manager に値があればそれを返す
 * 2. localStorage に旧キーがあれば Credential Manager へ移行（成功時に localStorage 削除）
 */
export async function migrateFromLocalStorage(): Promise<string | null> {
  const storedKey = await loadApiKey();
  if (storedKey) {
    return storedKey;
  }

  const legacyKey = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!legacyKey) {
    return null;
  }

  try {
    await saveApiKey(legacyKey);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to migrate API key from localStorage:", err);
  }

  return legacyKey;
}
