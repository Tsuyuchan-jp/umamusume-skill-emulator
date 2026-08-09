"use client";

import React, { useState } from "react";
import {
  buildOcrSkillDiagnostics,
  formatOcrSkillDiagnosticsText,
} from "../lib/fuzzyMatcher";

interface OcrDiagnosticPanelProps {
  /** Gemini が返した正規化前の生スキル名配列 */
  rawSkills: string[];
}

/**
 * Phase A 一時診断 UI。実機で OCR 欠落／マッチ失敗を切り分ける。
 * Phase B 実機確認後に削除予定。
 */
export function OcrDiagnosticPanel({ rawSkills }: OcrDiagnosticPanelProps) {
  const [copyLabel, setCopyLabel] = useState("診断をコピー");
  const diag = buildOcrSkillDiagnostics(rawSkills);

  const handleCopy = async () => {
    const text = formatOcrSkillDiagnosticsText(diag);
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("コピーしました");
      setTimeout(() => setCopyLabel("診断をコピー"), 2000);
    } catch {
      setCopyLabel("コピー失敗");
      setTimeout(() => setCopyLabel("診断をコピー"), 2000);
    }
  };

  return (
    <details className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-sm text-zinc-300">
      <summary className="cursor-pointer select-none font-semibold text-amber-200/90">
        OCR 診断（切り分け用・一時）
      </summary>

      <div className="mt-3 flex flex-col gap-3 border-t border-amber-900/40 pt-3">
        <p className="text-xs leading-relaxed text-zinc-400">
          生OCR なし → OCR 欠落 ／ あり・除外 → 誤読マッチ失敗 ／ あり・採用なのに一覧に無い → 表示側バグ
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-zinc-400">
            生スキル数: <span className="text-zinc-200">{diag.rawSkills.length}</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-amber-600/60 hover:text-amber-100"
          >
            {copyLabel}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {diag.focus.map((f) => {
            const verdict = f.match.accepted ? "採用" : "除外";
            return (
              <div
                key={f.name}
                className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 font-mono text-xs"
              >
                <div className="font-sans text-sm font-semibold text-zinc-100">{f.name}</div>
                <div className="mt-1 text-zinc-400">
                  生OCR:{" "}
                  <span className={f.presentInRaw ? "text-emerald-400" : "text-rose-400"}>
                    {f.presentInRaw ? "あり" : "なし"}
                  </span>
                  {f.rawHits.length > 0 && (
                    <span className="text-zinc-500">（{f.rawHits.join(" / ")}）</span>
                  )}
                </div>
                <div className="mt-0.5 text-zinc-400">
                  マッチ:{" "}
                  <span className={f.match.accepted ? "text-emerald-400" : "text-rose-400"}>
                    {verdict}
                  </span>
                  {" / "}rating={f.match.rating.toFixed(3)}
                  {" / "}最良={f.match.bestMatchName || "(なし)"}
                  {f.match.skillId ? ` / id=${f.match.skillId}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <details className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
          <summary className="cursor-pointer select-none text-xs text-zinc-400">
            生スキル名の全文リスト（{diag.rawSkills.length}件）
          </summary>
          <ul className="mt-2 max-h-48 list-none space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-400">
            {diag.rawSkills.map((s, i) => {
              const e = diag.entries[i];
              const verdict = e?.accepted ? "採用" : "除外";
              return (
                <li key={`${i}-${s}`} className="break-all">
                  <span className="text-zinc-500">{i + 1}.</span> {s}
                  <span className="text-zinc-600">
                    {" "}
                    → {verdict} r={e?.rating.toFixed(2) ?? "0"} {e?.bestMatchName || ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </details>
  );
}
