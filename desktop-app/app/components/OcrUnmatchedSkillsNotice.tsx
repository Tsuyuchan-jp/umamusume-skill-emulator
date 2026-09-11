"use client";

import React, { useMemo, useState } from "react";
import {
  buildUnmatchedOcrSkills,
  formatOcrFailedSkillsText,
  formatSimExcludedOcrSkillsText,
  partitionUnmatchedOcrSkills,
  type UnmatchedOcrSkill,
} from "../lib/fuzzyMatcher";

interface OcrUnmatchedSkillsNoticeProps {
  /** Gemini が返した正規化前の生スキル名配列 */
  rawSkills: string[];
}

function useCopyButton(makeText: () => string) {
  const [copyLabel, setCopyLabel] = useState("スキル名をコピー");
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(makeText());
      setCopyLabel("コピーしました");
      setTimeout(() => setCopyLabel("スキル名をコピー"), 2000);
    } catch {
      setCopyLabel("コピー失敗");
      setTimeout(() => setCopyLabel("スキル名をコピー"), 2000);
    }
  };
  return { copyLabel, handleCopy };
}

function UnmatchedNoticeBlock({
  title,
  body,
  items,
  showClosest,
  tone,
  copyText,
}: {
  title: string;
  body: string;
  items: UnmatchedOcrSkill[];
  showClosest: boolean;
  tone: "neutral" | "warn";
  copyText: string;
}) {
  const { copyLabel, handleCopy } = useCopyButton(() => copyText);
  const box =
    tone === "warn"
      ? "rounded-lg border border-amber-800/40 bg-amber-950/15 px-3 py-2 text-sm text-zinc-300"
      : "rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300";
  const summary =
    tone === "warn"
      ? "cursor-pointer select-none whitespace-nowrap font-semibold text-amber-100/90"
      : "cursor-pointer select-none whitespace-nowrap font-semibold text-zinc-200";
  const divider = tone === "warn" ? "border-amber-900/30" : "border-zinc-700/50";
  const hover =
    tone === "warn"
      ? "hover:border-amber-600/50 hover:text-amber-100"
      : "hover:border-zinc-500 hover:text-zinc-100";

  return (
    <details className={box}>
      <summary className={summary}>
        {title}（{items.length}件）
      </summary>
      <div className={`mt-3 flex flex-col gap-2.5 border-t ${divider} pt-3`}>
        <p className="text-xs leading-relaxed text-zinc-400">{body}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 ${hover}`}
          >
            {copyLabel}
          </button>
        </div>
        <ul className="max-h-48 list-none space-y-1.5 overflow-y-auto text-xs text-zinc-300">
          {items.map((item, i) => (
            <li key={`${i}-${item.input}`} className="break-all">
              <span className="text-zinc-100">{item.input}</span>
              {showClosest && item.closestName ? (
                <span className="text-zinc-500">（近い候補: {item.closestName}）</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/**
 * OCR 未マッチの恒久通知 UI（SkillPanel 内・見出し直下）。
 * シミュ対象外と読み取り失敗を分け、0件の欄は出さない。
 */
export function OcrUnmatchedSkillsNotice({ rawSkills }: OcrUnmatchedSkillsNoticeProps) {
  const unmatched = useMemo(() => buildUnmatchedOcrSkills(rawSkills), [rawSkills]);
  const { simExcluded, ocrFailed } = useMemo(
    () => partitionUnmatchedOcrSkills(unmatched),
    [unmatched]
  );

  if (simExcluded.length === 0 && ocrFailed.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {simExcluded.length > 0 ? (
        <UnmatchedNoticeBlock
          title="シミュ対象外"
          body="画面では読めましたが、このアプリのシミュレーションでは使わないスキルです。読み取りの失敗ではありません。"
          items={simExcluded}
          showClosest={false}
          tone="neutral"
          copyText={formatSimExcludedOcrSkillsText(simExcluded)}
        />
      ) : null}
      {ocrFailed.length > 0 ? (
        <UnmatchedNoticeBlock
          title="読み取り失敗"
          body="名前を正式なスキル名に合わせられなかったため、取得スキルに入っていません。"
          items={ocrFailed}
          showClosest={true}
          tone="warn"
          copyText={formatOcrFailedSkillsText(ocrFailed)}
        />
      ) : null}
    </div>
  );
}
