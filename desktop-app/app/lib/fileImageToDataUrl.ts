import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * ローカル画像パスを dataUrl に変換する。
 * convertFileSrc → fetch のため plugin-fs の任意パス読取権限は不要。
 */
export async function filePathToDataUrl(filePath: string): Promise<string> {
  const assetUrl = `${convertFileSrc(filePath)}?t=${Date.now()}`;
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`画像の読み込みに失敗しました (${response.status})`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("dataUrl への変換に失敗しました"));
      }
    };
    reader.onerror = () => reject(new Error("dataUrl への変換に失敗しました"));
    reader.readAsDataURL(blob);
  });
}
