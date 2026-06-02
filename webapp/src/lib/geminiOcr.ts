import type { UmaStatusData } from "./types";
import { normalizeStatusData } from "./fuzzyMatcher";

const MODEL_PRIMARY = "gemini-3.5-flash";
const MODEL_FALLBACK = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION = `あなたはゲーム「ウマ娘 プリティーダービー」の詳細ステータス画面を解析するAIです。画像から以下の情報をJSON形式で抽出してください。

【重要】抽出する情報：
・基礎ステータス：スピード、スタミナ、パワー、根性、賢さの数値を抽出してください。
・バ場適性：芝（turf）、ダート（dirt）の適性ランク（S, A, B, C, D, E, F, G）を抽出してください。
・距離適性：短距離（short）、マイル（mile）、中距離（medium）、長距離（long）の適性ランクを抽出してください。
・脚質適性：逃げ（nige）、先行（senkou）、差し（sashi）、追込（oikomi）の適性ランクを抽出してください。
・取得スキル：画面に表示されている取得スキル（固有スキル、レアスキル、ノーマルスキル等）の名前をすべて抽出し、文字列の配列としてください。

出力フォーマット:
\`\`\`json
{
  "speed": 1000,
  "stamina": 800,
  "power": 1200,
  "guts": 600,
  "wisdom": 900,
  "aptitudes": {
    "turf": "A",
    "dirt": "G",
    "short": "G",
    "mile": "C",
    "medium": "A",
    "long": "S",
    "nige": "G",
    "senkou": "A",
    "sashi": "B",
    "oikomi": "S"
  },
  "skills": [
    "弧線のプロフェッサー",
    "末脚"
  ]
}
\`\`\`
`;

export async function analyzeImageWithGemini(
  base64Image: string,
  apiKey: string
): Promise<UmaStatusData> {
  const payload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_INSTRUCTION },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
    },
  };

  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_PRIMARY}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      console.warn(`${MODEL_PRIMARY} failed. Falling back to ${MODEL_FALLBACK}`);
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_FALLBACK}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawText) {
    throw new Error("No text returned from Gemini");
  }

  try {
    const jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(jsonStr) as UmaStatusData;
    // Normalize data (FuzzyMatch for skills etc.)
    return normalizeStatusData(parsedData);
  } catch (e) {
    console.error("Failed to parse Gemini output:", rawText);
    throw new Error("Failed to parse JSON from Gemini");
  }
}
