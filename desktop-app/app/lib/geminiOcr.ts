import { UmaStatusData } from "./types";
import { normalizeStatusData } from "./fuzzyMatcher";

const MODEL_PRIMARY = "gemini-3.5-flash";
const MODEL_FALLBACK = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION = `あなたはゲーム「ウマ娘 プリティーダービー」の詳細ステータス画面の画像を解析するAIです。
画像から以下の情報をJSON形式で抽出してください。
存在しない項目はnullを返すか、リストの場合は空配列にしてください。

【重要：抽出する情報】
・基礎ステータス（stats）：スピード、スタミナ、パワー、根性、賢さの数値を整数で抽出してください。
・適性（aptitudes）：バ場適性（芝、ダート）、距離適性（短距離、マイル、中距離、長距離）、脚質適性（逃げ、先行、差し、追込）を抽出してください。A、B、C、Sなどのアルファベット1文字です。
・取得スキル（skills）：画面に表示されている取得済みスキルの名前のリストを抽出してください。

出力フォーマット:
\`\`\`json
{
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
    } catch (e) {
      candidate = candidate.substring(0, lastBraceIdx);
      lastBraceIdx = candidate.lastIndexOf('}');
    }
  }
  
  throw new Error("JSONの自動修復に失敗しました。");
}


/**
 * 結合済みのDataURL画像1枚を送信する（デフォルト）
 */
export async function analyzeStitchedImage(apiKey: string, dataUrl: string): Promise<{ data: UmaStatusData; modelUsed: string }> {
  const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
  
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
              mime_type: "image/png",
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

  let modelUsed = MODEL_PRIMARY;
  let responseData: any;

  const callApi = async (model: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw { status: res.status, message: errorText };
    }
    return res.json();
  };

  try {
    responseData = await callApi(MODEL_PRIMARY);
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      console.warn(`[Auto-Fallback] ${MODEL_PRIMARY} is busy/limited. Switching to ${MODEL_FALLBACK}...`);
      modelUsed = MODEL_FALLBACK;
      try {
        responseData = await callApi(MODEL_FALLBACK);
      } catch (fallbackErr: any) {
        if (fallbackErr.status === 429 || fallbackErr.status === 503) {
          throw new Error(`Gemini APIの制限またはサーバー混雑に達しました。数秒〜数分待ってから再度お試しください。`);
        }
        throw new Error(`Gemini API Error (Fallback ${fallbackErr.status}): ${fallbackErr.message}`);
      }
    } else {
      throw new Error(`Gemini API Error (${err.status}): ${err.message}`);
    }
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
    } catch (repairError) {
      throw new Error("AIの機嫌が悪く解析に失敗しました！お手数ですがもう一度キャプチャをお試しください🙏");
    }
  }

  return { data: normalizeStatusData(rawData) as UmaStatusData, modelUsed };
}

/**
 * 結合前のフレーム画像を複数枚送信する（精度検証用）
 */
export async function analyzeFrames(apiKey: string, dataUrls: string[]): Promise<{ data: UmaStatusData; modelUsed: string }> {
  const imageParts = dataUrls.map(url => ({
    inline_data: {
      mime_type: "image/png",
      data: url.replace(/^data:image\/(png|jpeg);base64,/, "")
    }
  }));

  const payload = {
    system_instruction: {
      parts: { text: SYSTEM_INSTRUCTION }
    },
    contents: [
      {
        parts: [
          { text: "これらの連続するスクリーンショットからステータス情報を1つのJSONにまとめて抽出してください。重複する項目は1つに統合してください。" },
          ...imageParts
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  let modelUsed = MODEL_PRIMARY;
  let responseData: any;

  const callApi = async (model: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw { status: res.status, message: errorText };
    }
    return res.json();
  };

  try {
    responseData = await callApi(MODEL_PRIMARY);
  } catch (err: any) {
    if (err.status === 429) {
      console.warn(`[Auto-Fallback] ${MODEL_PRIMARY} rate limit hit. Switching to ${MODEL_FALLBACK}...`);
      modelUsed = MODEL_FALLBACK;
      try {
        responseData = await callApi(MODEL_FALLBACK);
      } catch (fallbackErr: any) {
        throw new Error(`Gemini API Error (Fallback ${fallbackErr.status}): ${fallbackErr.message}`);
      }
    } else {
      throw new Error(`Gemini API Error (${err.status}): ${err.message}`);
    }
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
    } catch (repairError) {
      throw new Error("AIの機嫌が悪く解析に失敗しました！お手数ですがもう一度キャプチャをお試しください🙏");
    }
  }

  return { data: normalizeStatusData(rawData) as UmaStatusData, modelUsed };
}
