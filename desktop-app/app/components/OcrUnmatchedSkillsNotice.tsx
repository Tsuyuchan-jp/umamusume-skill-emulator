"use client";

import React, { useMemo, useState } from "react";
import {
  buildUnmatchedOcrSkills,
  formatUnmatchedOcrSkillsText,
} from "../lib/fuzzyMatcher";

interface OcrUnmatchedSkillsNoticeProps {
  /** Gemini が返した正規化前の生スキル名配列 */
  rawSkills: string[];
}

/**
 * OCR 未マッチの恒久通知 UI（SkillPanel 内・見出し直下）。
 * 0件なら Dom ごと出さない。1件以上は折りたたみ＋コピー。
 */
export function OcrUnmatchedSkillsNotice({ rawSkills }: OcrUnmatchedSkillsNoticeProps) {
  const unmatched = useMemo(() => buildUnmatchedOcrSkills(rawSkills), [rawSkills]);
  const [copyLabel, setCopyLabel] = useState("スキル名をコピー");

  if (unmatched.length === 0) return null;

  const handleCopy = async () => {
    const text = formatUnmatchedOcrSkillsText(unmatched);
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("コピーしました");
      setTimeout(() => setCopyLabel("スキル名をコピー"), 2000);
    } catch {
      setCopyLabel("コピー失敗");
      setTimeout(() => setCopyLabel("スキル名をコピー"), 2000);
    }
  };

  return (
    <details className="rounded-lg border border-amber-800/40 bg-amber-950/15 px-3 py-2 text-sm text-zinc-300">
      <summary className="cursor-pointer select-none whitespace-nowrap font-semibold text-amber-100/90">
        読み取り失敗（{unmatched.length}件）
      </summary>

      <div className="mt-3 flex flex-col gap-2.5 border-t border-amber-900/30 pt-3">
        <p className="text-xs leading-relaxed text-zinc-400">
          取得スキルに入らなかったOCRスキル名です。
        </p>
        <p className="text-xs leading-relaxed text-zinc-500">
          一部デバフはシミュに適用されないため、取得スキルには含まれません。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-amber-600/50 hover:text-amber-100"
          >
            {copyLabel}
          </button>
        </div>

        <ul className="max-h-48 list-none space-y-1.5 overflow-y-auto text-xs text-zinc-300">
          {unmatched.map((item, i) => (
            <li key={`${i}-${item.input}`} className="break-all">
              <span className="text-zinc-100">{item.input}</span>
              {item.closestName ? (
                <span className="text-zinc-500">（近い候補: {item.closestName}）</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
