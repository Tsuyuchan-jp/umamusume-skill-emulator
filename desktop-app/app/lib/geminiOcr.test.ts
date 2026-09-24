import { describe, expect, it } from "vitest";
import { GEMINI_OCR_MODEL, formatGeminiApiError, parseInlineImageDataUrl } from "./geminiOcr";
import { guessImageMimeFromPath } from "./fileImageToDataUrl";

describe("parseInlineImageDataUrl", () => {
  it("PNG / JPEG / WebP の MIME を保持する", () => {
    expect(parseInlineImageDataUrl("data:image/png;base64,AAA")).toEqual({
      mimeType: "image/png",
      base64Data: "AAA",
    });
    expect(parseInlineImageDataUrl("data:image/jpeg;base64,BBB")).toEqual({
      mimeType: "image/jpeg",
      base64Data: "BBB",
    });
    expect(parseInlineImageDataUrl("data:image/webp;base64,CCC")).toEqual({
      mimeType: "image/webp",
      base64Data: "CCC",
    });
  });

  it("image/jpg は image/jpeg に正規化する", () => {
    expect(parseInlineImageDataUrl("data:image/jpg;base64,DDD")).toEqual({
      mimeType: "image/jpeg",
      base64Data: "DDD",
    });
  });

  it("未対応 MIME はエラー", () => {
    expect(() => parseInlineImageDataUrl("data:image/gif;base64,EEE")).toThrow(
      /未対応の画像形式/
    );
  });
});

describe("Gemini OCR のモデルとエラー表示", () => {
  it("後継の Flash-Lite モデルを使う", () => {
    expect(GEMINI_OCR_MODEL).toBe("gemini-3.5-flash-lite");
  });

  it("429 と 503 を区別し、API の詳細を表示する", () => {
    const apiError = JSON.stringify({ error: { message: "Daily request limit exceeded" } });

    expect(formatGeminiApiError(429, apiError)).toContain("利用枠");
    expect(formatGeminiApiError(429, apiError)).toContain("Daily request limit exceeded");
    expect(formatGeminiApiError(503, apiError)).toContain("一時的に利用できません");
    expect(formatGeminiApiError(503, apiError)).toContain("Daily request limit exceeded");
  });
});

describe("guessImageMimeFromPath", () => {
  it("拡張子から MIME を返す", () => {
    expect(guessImageMimeFromPath("C:\\tmp\\a.PNG")).toBe("image/png");
    expect(guessImageMimeFromPath("/tmp/b.jpeg")).toBe("image/jpeg");
    expect(guessImageMimeFromPath("c.webp")).toBe("image/webp");
    expect(guessImageMimeFromPath("notes.txt")).toBeNull();
  });
});
