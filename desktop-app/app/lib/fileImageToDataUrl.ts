import { convertFileSrc } from "@tauri-apps/api/core";

/** 拡張子から OCR 送信用の画像 MIME を推定する */
export function guessImageMimeFromPath(filePath: string): string | null {
  const name = filePath.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

/**
 * ローカル画像パスを dataUrl に変換する。
 * convertFileSrc → fetch のため plugin-fs の任意パス読取権限は不要。
 * blob の Content-Type が空や octet-stream でも、拡張子から MIME を補う。
 */
export async function filePathToDataUrl(filePath: string): Promise<string> {
  const assetUrl = `${convertFileSrc(filePath)}?t=${Date.now()}`;
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`画像の読み込みに失敗しました (${response.status})`);
  }
  const blob = await response.blob();
  const guessed = guessImageMimeFromPath(filePath);
  const toRead =
    guessed && blob.type !== guessed ? new Blob([blob], { type: guessed }) : blob;
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
    reader.readAsDataURL(toRead);
  });
}
