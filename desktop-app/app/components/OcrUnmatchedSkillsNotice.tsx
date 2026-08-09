"use client";

import React, { useMemo, useState } from "react";
import {
  buildUnmatchedOcrSkills,
  formatUnmatchedOcrSkillsText,
} from "../lib/fuzzyMatcher";

/** SkillPanel 内最上（A''） / SkillPanel 直前（A'） */
export type UnmatchedNoticePlacement = "inside" | "before";

interface OcrUnmatchedSkillsNoticeProps {
  /** Gemini が返した正規化前の生スキル名配列 */
  rawSkills: string[];
  /** 現在の表示位置 */
  placement: UnmatchedNoticePlacement;
  /** 位置切替（セッション内 state） */
  onPlacementChange: (placement: UnmatchedNoticePlacement) => void;
}

/**
 * OCR 未マッチの恒久通知 UI。
 * 0件なら Dom ごと出さない。1件以上は折りたたみ＋コピー＋位置トグル。
 */
export function OcrUnmatchedSkillsNotice({
  rawSkills,
  placement,
  onPlacementChange,
}: OcrUnmatchedSkillsNoticeProps) {
  const unmatched = useMemo(() => buildUnmatchedOcrSkills(rawSkills), [rawSkills]);
  const [copyLabel, setCopyLabel] = useState("名前をコピー");

  if (unmatched.length === 0) return null;

  const handleCopy = async () => {
    const text = formatUnmatchedOcrSkillsText(unmatched);
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("コピーしました");
      setTimeout(() => setCopyLabel("名前をコピー"), 2000);
    } catch {
      setCopyLabel("コピー失敗");
      setTimeout(() => setCopyLabel("名前をコピー"), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="shrink-0">表示位置:</span>
        <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950/60 p-0.5">
          <button
            type="button"
            onClick={() => onPlacementChange("inside")}
            className={`rounded px-2 py-1 transition-colors ${
              placement === "inside"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            パネル内最上
          </button>
          <button
            type="button"
            onClick={() => onPlacementChange("before")}
            className={`rounded px-2 py-1 transition-colors ${
              placement === "before"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            パネルの直前
          </button>
        </div>
      </div>

      <details className="rounded-lg border border-amber-800/40 bg-amber-950/15 px-3 py-2 text-sm text-zinc-300">
        <summary className="cursor-pointer select-none font-semibold text-amber-100/90">
          読み取れたが一覧に入れなかった名前（{unmatched.length}）
        </summary>

        <div className="mt-3 flex flex-col gap-3 border-t border-amber-900/30 pt-3">
          <p className="text-xs leading-relaxed text-zinc-400">
            画面から読めましたが、アプリのスキル一覧に対応できませんでした。誤読や、シミュレーション用データに無い名前のことがあります。一覧とシミュレーションには含まれません。
          </p>
          <p className="text-xs leading-relaxed text-zinc-500">
            逃げためらいなどの一部デバフは、本家シミュレーション用データに無いため一覧に出ません。
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
    </div>
  );
}
