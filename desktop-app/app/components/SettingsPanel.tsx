"use client";

import { useState, useEffect } from "react";
import { Folder, Keyboard, Settings, Key, ChevronDown, ChevronUp } from "lucide-react";
import {
  probeSkillDataSources,
  type SkillDataSource,
} from "../lib/engine/umaemuAdapter";
import { SKILL_DATA_FETCH_ERROR_MESSAGE } from "../lib/engine/simulationErrors";

const SETTINGS_PANEL_EXPANDED_KEY = "settingsPanelExpanded";

const PROBE_RESULT_MESSAGES: Record<SkillDataSource, string> = {
  remote: "オンライン（GitHub）から取得できました。最新データを利用できます。",
  cache: "オンライン取得はできませんでしたが、保存済みデータは利用できます。",
  bundled:
    "オンライン／保存済みは使えませんでしたが、同梱データは利用できます（最新ではない可能性があります）。",
};

interface SettingsPanelProps {
  autoCopyEnabled: boolean;
  skipStitchedDiskSave: boolean;
  saveFolder: string;
  shortcutKey: string;
  isRecordingShortcut: boolean;
  apiKey: string;
  onToggleAutoCopy: (enabled: boolean) => void;
  onToggleSkipStitchedDiskSave: (enabled: boolean) => void;
  onSelectFolder: () => void;
  onRecordingShortcutStart: () => void;
  onRecordingShortcutBlur: () => void;
  onKeyDownForShortcut: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onShowApiKeyModal: () => void;
  shortcutInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SettingsPanel({
  autoCopyEnabled,
  skipStitchedDiskSave,
  saveFolder,
  shortcutKey,
  isRecordingShortcut,
  apiKey,
  onToggleAutoCopy,
  onToggleSkipStitchedDiskSave,
  onSelectFolder,
  onRecordingShortcutStart,
  onRecordingShortcutBlur,
  onKeyDownForShortcut,
  onShowApiKeyModal,
  shortcutInputRef
}: SettingsPanelProps) {
  // SSR と初回クライアント描画を一致させるため、localStorage はマウント後に読む
  const [isExpanded, setIsExpanded] = useState(true);
  const [probeChecking, setProbeChecking] = useState(false);
  const [probeResultText, setProbeResultText] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_PANEL_EXPANDED_KEY);
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(SETTINGS_PANEL_EXPANDED_KEY, String(next));
      return next;
    });
  };

  const handleProbeSkillData = async () => {
    if (probeChecking) return;
    setProbeChecking(true);
    setProbeResultText("確認中…");
    try {
      const source = await probeSkillDataSources();
      setProbeResultText(PROBE_RESULT_MESSAGES[source]);
    } catch {
      setProbeResultText(SKILL_DATA_FETCH_ERROR_MESSAGE);
    } finally {
      setProbeChecking(false);
    }
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "設定を折りたたむ" : "設定を展開する"}
            className="flex items-center gap-1.5 min-w-0 bg-transparent border-0 p-0 cursor-pointer"
          >
            <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
            <span className="text-sm font-semibold tracking-wide text-zinc-300 flex items-center gap-2 whitespace-nowrap shrink-0">
              <Settings className="w-4 h-4 text-emerald-400" /> 設定
            </span>
          </button>
          <label
            className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-300 transition-colors group shrink-0"
            title="完了時にクリップボードへ自動コピー"
          >
            <div className="relative flex items-center justify-center w-4 h-4 rounded border border-zinc-800 bg-zinc-900/50 group-hover:border-emerald-500/50 transition-colors shrink-0">
              <input
                type="checkbox"
                className="absolute opacity-0 w-full h-full cursor-pointer z-10"
                checked={autoCopyEnabled}
                onChange={(e) => onToggleAutoCopy(e.target.checked)}
              />
              <svg className={`w-3 h-3 text-emerald-400 absolute transition-opacity ${autoCopyEnabled ? "opacity-100" : "opacity-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <span className="whitespace-nowrap">自動コピー</span>
          </label>
        </div>

        {isExpanded && (
          <>
            <div className="h-px w-full bg-white/[0.05]"></div>

            <label
              className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-300 transition-colors group"
              title="ON のとき結合画像はメモリ上のプレビューのみ（OCR 用）。PC ディスクには保存しません"
            >
              <div className="relative flex items-center justify-center w-4 h-4 rounded border border-zinc-800 bg-zinc-900/50 group-hover:border-emerald-500/50 transition-colors shrink-0">
                <input
                  type="checkbox"
                  className="absolute opacity-0 w-full h-full cursor-pointer z-10"
                  checked={skipStitchedDiskSave}
                  onChange={(e) => onToggleSkipStitchedDiskSave(e.target.checked)}
                />
                <svg className={`w-3 h-3 text-emerald-400 absolute transition-opacity ${skipStitchedDiskSave ? "opacity-100" : "opacity-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <span>結合画像をディスクに保存しない</span>
            </label>

            <div className={`flex flex-col gap-2 ${skipStitchedDiskSave ? "opacity-50" : ""}`}>
              <div className="flex flex-col gap-0.5 w-full">
                <span className="text-xs font-medium text-zinc-300">画像の保存先フォルダ</span>
                <span className="text-[10px] text-zinc-500">
                  {skipStitchedDiskSave
                    ? "非保存 ON のため使用しません（設定値は保持されます）"
                    : "未設定時は標準ダウンロードフォルダ"}
                </span>
              </div>
              <div className={`flex w-full min-w-0 items-center bg-zinc-950/50 border border-zinc-800/80 rounded-lg overflow-hidden group transition-colors ${skipStitchedDiskSave ? "pointer-events-none" : "focus-within:border-emerald-500/50"}`}>
                <div className="pl-3 pr-2 text-zinc-500 shrink-0">
                  <Folder className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <input
                  type="text"
                  readOnly
                  placeholder="未設定"
                  disabled={skipStitchedDiskSave}
                  className="flex-1 bg-transparent py-2 text-xs text-zinc-300 outline-none truncate min-w-0 disabled:text-zinc-500"
                  title={skipStitchedDiskSave ? "結合画像をディスクに保存しないが ON のため無効" : (saveFolder || "標準のダウンロードフォルダ")}
                  value={saveFolder}
                />
                <button
                  onClick={onSelectFolder}
                  disabled={skipStitchedDiskSave}
                  className="shrink-0 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2 border-l border-zinc-700/50 transition-all active:bg-emerald-700 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-300"
                >
                  変更
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.05]">
              <div className="flex flex-col gap-0.5 w-full">
                <span className="text-xs font-medium text-zinc-300">キャプチャ開始/停止キー</span>
                <span className="text-[10px] text-zinc-500">グローバルでキャプチャをトグル</span>
              </div>
              <div className={`flex w-full min-w-0 items-center bg-zinc-950/50 border ${isRecordingShortcut ? "border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "border-zinc-800/80"} rounded-lg overflow-hidden group focus-within:border-emerald-500/50 transition-colors`}>
                <div className="pl-3 pr-2 text-zinc-500 shrink-0">
                  <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <input
                  type="text"
                  readOnly
                  ref={shortcutInputRef}
                  value={isRecordingShortcut ? "キーを入力してください..." : shortcutKey}
                  placeholder="未設定"
                  onKeyDown={onKeyDownForShortcut}
                  onBlur={onRecordingShortcutBlur}
                  className={`flex-1 bg-transparent py-2 text-xs outline-none truncate min-w-0 transition-colors ${isRecordingShortcut ? "text-emerald-400 font-bold" : "text-zinc-300"}`}
                />
                <button
                  onClick={onRecordingShortcutStart}
                  className={`shrink-0 text-xs font-semibold px-4 py-2 border-l border-zinc-700/50 transition-all ${isRecordingShortcut ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white active:bg-emerald-700"}`}
                >
                  {isRecordingShortcut ? "入力中" : "変更"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 min-w-0 pt-3 border-t border-white/[0.05]">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-medium text-zinc-300">Gemini APIキー</span>
                <span className="text-[10px] text-zinc-500">OCR解析用</span>
              </div>
              <button
                onClick={onShowApiKeyModal}
                className="shrink-0 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2 border border-zinc-700/50 rounded-lg transition-all active:bg-emerald-700 flex items-center gap-2"
              >
                <Key className="w-3.5 h-3.5" />
                {apiKey ? "修正済み" : "未設定"}
              </button>
            </div>

            <details className="pt-3 border-t border-white/[0.05] group">
              <summary className="cursor-pointer select-none text-xs font-medium text-zinc-300 list-none flex items-center gap-1.5 hover:text-zinc-200 transition-colors [&::-webkit-details-marker]:hidden">
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform group-open:rotate-180" />
                シミュレーション用データ（診断）
              </summary>
              <div className="mt-2 flex flex-col gap-2 pl-5">
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  シミュレーション（WASM）が使うスキルデータの取得先を確認します。OCR・スキルパレット用のデータとは別です。
                </p>
                <button
                  type="button"
                  onClick={handleProbeSkillData}
                  disabled={probeChecking}
                  className="self-start shrink-0 bg-zinc-800 hover:bg-emerald-600 disabled:opacity-60 disabled:hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:hover:text-zinc-300 text-xs font-semibold px-4 py-2 border border-zinc-700/50 rounded-lg transition-all active:bg-emerald-700"
                >
                  接続を確認
                </button>
                {probeResultText != null && (
                  <p
                    className="text-[11px] text-zinc-400 leading-relaxed"
                    role="status"
                    aria-live="polite"
                  >
                    {probeResultText}
                  </p>
                )}
              </div>
            </details>
          </>
        )}

        <p className="text-[10px] text-zinc-500 leading-relaxed pt-3 border-t border-white/[0.05]">
          レースシミュレーションは umasim（mee1080、AGPLv3）を利用しています。
        </p>
      </div>
    </div>
  );
}
