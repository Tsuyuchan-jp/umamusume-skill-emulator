import { UmaStatusData } from "./types";
import { normalizeStatusData } from "./fuzzyMatcher";

/** OCR は Gemini 3.1 Flash-Lite の後継モデルを使用する。 */
export const GEMINI_OCR_MODEL = "gemini-3.5-flash-lite";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Gemini のエラー本文から、利用者が確認できる要点だけを取り出す。 */
export function formatGeminiApiError(status: number, errorText: string): string {
  let detail = errorText;
  try {
    const parsed = JSON.parse(errorText) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") {
      detail = parsed.error.message;
    }
  } catch {
    // JSON ではない応答はそのまま使う
  }

  // トーストを読みやすく保ち、意図しない長大な応答も表示しない。
  const conciseDetail = detail.replace(/\s+/g, " ").trim().slice(0, 240);
  const suffix = conciseDetail ? `（詳細: ${conciseDetail}）` : "";

  if (status === 429) {
    return `Gemini API の利用枠に達しました。Google AI Studio の Rate limits を確認してください。${suffix}`;
  }
  if (status === 503) {
    return `Gemini API サーバーが一時的に利用できません。時間をおいて再試行してください。${suffix}`;
  }
  return `Gemini API Error (${status}): ${conciseDetail || "応答内容を取得できませんでした"}`;
}

/** ユーザー中止（AbortSignal）由来のエラーか。ApiError(429/503) に変換しない */
function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError";
}

const SYSTEM_INSTRUCTION = `あなたはゲーム「ウマ娘 プリティーダービー」の詳細ステータス画面の画像を解析するAIです。
画像から以下の情報をJSON形式で抽出してください。
存在しない項目はnullを返すか、リストの場合は空配列にしてください。

【重要：抽出する情報】
・キャラクター名（name）：画像の上部やスキルリストの上部に表示されているウマ娘の名前（例：スペシャルウィーク、ジェンティルドンナ等。二つ名やランク表記は含めないでください）を抽出してください。
・基礎ステータス（stats）：スピード、スタミナ、パワー、根性、賢さの数値を整数で抽出してください。
・適性（aptitudes）：バ場適性（芝、ダート）、距離適性（短距離、マイル、中距離、長距離）、脚質適性（逃げ、先行、差し、追込）を抽出してください。A、B、C、Sなどのアルファベット1文字です。
・取得スキル（skills）：画面に表示されている取得済みスキルの名前のリストを抽出してください。
  ※ 注意: 「中距離コーナー〇」と「中距離コーナー◎」のように、末尾の記号（〇、◎、×など）はスキルレベルを表す極めて重要な情報です。一文字も間違えずに、画像にある通りの記号を完全に含めて抽出してください。
  ※ レイアウトと抽出の徹底: スキルは「左右2列のグリッド状」に並んでいます。上から下へ、左、右、左、右の順で読んでください。また、画像は非常に縦長ですが、一番下の最後まで絶対に全て読み取ってください。途中で抽出を打ち切ることは致命的なエラーになります。一つきりのスキルも残さず抽出してください。

出力フォーマット:
\`\`\`json
{
  "name": "スペシャルウィーク",
  "stats": {
    "speed": 1200,
    "stamina": 800,
    "power": 1000,
    "guts": 600,
    "wisdom": 1200
  },
  "aptitudes": {
    "turf": "A",
    "dirt": "G",
    "short": "G",
    "mile": "C",
    "medium": "A",
    "long": "A",
    "nige": "G",
    "senkou": "A",
    "sashi": "B",
    "oikomi": "G"
  },
  "skills": [
    "弧線のプロフェッサー",
    "末脚"
  ]
}
\`\`\``;
/**
 * Geminiが稀に出力する末尾の余分な括弧やMarkdown修飾子を除去し、
 * 正当なJSON部分のみを切り出してパースを試みる修復用ヘルパー関数です。
 */
function cleanAndParseJSON(str: string): any {
  const startIdx = str.indexOf('{');
  if (startIdx === -1) {
    throw new Error("JSONの開始位置が見つかりません。");
  }
  
  let candidate = str.substring(startIdx).trim();
  let lastBraceIdx = candidate.lastIndexOf('}');
  
  while (lastBraceIdx !== -1) {
    const jsonSub = candidate.substring(0, lastBraceIdx + 1);
    try {
      return JSON.parse(jsonSub);
    } catch {
      candidate = candidate.substring(0, lastBraceIdx);
      lastBraceIdx = candidate.lastIndexOf('}');
    }
  }
  
  throw new Error("JSONの自動修復に失敗しました。");
}


const SUPPORTED_INLINE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Gemini 送信用に dataUrl から MIME と Base64 本体を取り出す。
 * PNG / JPEG / WebP のみ（`image/jpg` は `image/jpeg` に正規化）。
 */
export function parseInlineImageDataUrl(dataUrl: string): {
  mimeType: string;
  base64Data: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) {
    throw new Error(
      "画像データの形式を認識できませんでした。PNG / JPEG / WebP を指定してください。"
    );
  }
  let mimeType = match[1].trim().toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (!SUPPORTED_INLINE_MIMES.has(mimeType)) {
    throw new Error(
      `未対応の画像形式です（${mimeType}）。PNG / JPEG / WebP を指定してください。`
    );
  }
  return { mimeType, base64Data: match[2] };
}

/**
 * 結合済みのDataURL画像1枚を送信する（デフォルト）
 * @param options.signal 中止用 AbortSignal（AbortController）。将来のファイル OCR でも再利用する
 */
export async function analyzeStitchedImage(
  apiKey: string,
  dataUrl: string,
  options?: { signal?: AbortSignal }
): Promise<{ data: UmaStatusData; modelUsed: string; rawSkills: string[] }> {
  const signal = options?.signal;
  const { mimeType, base64Data } = parseInlineImageDataUrl(dataUrl);

  const payload = {
    system_instruction: {
      parts: { text: SYSTEM_INSTRUCTION }
    },
    contents: [
      {
        parts: [
          { text: "この画像のステータス情報をJSONで抽出してください。" },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  const callApi = async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_OCR_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new ApiError(res.status, errorText);
    }
    return res.json();
  };

  let responseData: any;
  try {
    responseData = await callApi();
  } catch (err: unknown) {
    // 中止は ApiError(429/503) 扱いにせず、そのまま再 throw
    if (isAbortError(err)) throw err;

    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof ApiError) {
      throw new Error(formatGeminiApiError(status, message));
    }
    throw new Error(`Gemini API Error (${status}): ${message}`);
  }

  const jsonString = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonString) {
    throw new Error("APIレスポンスからテキストを抽出できませんでした。");
  }

  let rawData: any;
  try {
    rawData = JSON.parse(jsonString);
  } catch (initialError) {
    console.warn("JSONの標準パースに失敗しました。自動修復を試みます...", initialError);
    try {
      rawData = cleanAndParseJSON(jsonString);
      console.log("JSONの自動修復に成功しました！");
    } catch {
      throw new Error("AIの機嫌が悪く解析に失敗しました！お手数ですがもう一度キャプチャをお試しください🙏");
    }
  }

  const rawSkills: string[] = Array.isArray(rawData?.skills)
    ? rawData.skills.map((s: unknown) => String(s ?? ""))
    : [];

  return {
    data: normalizeStatusData(rawData) as UmaStatusData,
    modelUsed: GEMINI_OCR_MODEL,
    rawSkills,
  };
}
