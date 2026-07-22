import React from 'react';
import { Copy, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";
import { UmaStatusData } from "../lib/types";

interface CapturePanelProps {
  statusCfg: { color: string; pulse: boolean; label: string };
  captureStatus: string;
  captureMessage: string;
  captureError: string;
  debugFramePaths: string[];
  resultImage: string | null;
  umaData: UmaStatusData | null;
  autoCopyEnabled: boolean;
  saveFolder: string;
  shortcutKey: string;
  isRecordingShortcut: boolean;
  apiKey: string;
  isPreviewExpanded: boolean;
  isOcrProcessing: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
  shortcutInputRef: React.RefObject<HTMLInputElement | null>;
  
  onToggleAutoCopy: (enabled: boolean) => void;
  onSelectFolder: () => void;
  onRecordingShortcutStart: () => void;
  onRecordingShortcutBlur: () => void;
  onKeyDownForShortcut: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onShowApiKeyModal: () => void;
  
  onStartAutoCapture: () => void;
  onStopCapture: () => void;
  onResetCapture: () => void;
  onTogglePreviewExpanded: () => void;
  onCopyImage: (dataUrl: string) => void;
  onOcrStart: () => void;
  onOcrCancel: () => void;
}

export function CapturePanel(props: CapturePanelProps) {
  const {
    statusCfg, captureStatus, captureMessage, captureError, debugFramePaths,
    resultImage, umaData,
    autoCopyEnabled, saveFolder, shortcutKey, isRecordingShortcut, apiKey,
    isPreviewExpanded, isOcrProcessing, previewRef, shortcutInputRef,
    onToggleAutoCopy, onSelectFolder, onRecordingShortcutStart, onRecordingShortcutBlur,
    onKeyDownForShortcut, onShowApiKeyModal, onStartAutoCapture, onStopCapture,
    onResetCapture, onTogglePreviewExpanded, onCopyImage, onOcrStart, onOcrCancel
  } = props;

  return (
    <div className="w-full backdrop-blur-xl bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 shadow-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${statusCfg.color} ${statusCfg.pulse ? 'animate-pulse' : ''}`}></div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">画面キャプチャ連携</h2>
        </div>
        <div className="border-t border-white/[0.05] pt-4">
          <SettingsPanel
            autoCopyEnabled={autoCopyEnabled}
            onToggleAutoCopy={onToggleAutoCopy}
            saveFolder={saveFolder}
            onSelectFolder={onSelectFolder}
            shortcutKey={shortcutKey}
            isRecordingShortcut={isRecordingShortcut}
            onRecordingShortcutStart={onRecordingShortcutStart}
            onRecordingShortcutBlur={onRecordingShortcutBlur}
            onKeyDownForShortcut={onKeyDownForShortcut}
            shortcutInputRef={shortcutInputRef}
            apiKey={apiKey}
            onShowApiKeyModal={onShowApiKeyModal}
          />
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <p className="text-xs text-zinc-400">{captureMessage}</p>
          <p className="text-xs text-zinc-500 mt-1">
            キャプチャ前に対象タブ（スキル・継承・育成情報）を開いてください。
          </p>
        </div>

        {/* エラーメッセージ表示 */}
        {captureError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {captureError}
          </p>
        )}

        {/* キャプチャフレーム確認パネル（折りたたみ式） */}
        {debugFramePaths.length > 0 && (
          <details className="group">
            <summary className="text-xs font-semibold text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors flex items-center gap-1.5 select-none">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              キャプチャフレーム確認（{debugFramePaths.length}枚）
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent rounded-lg bg-black/30 p-2 border border-zinc-800/50">
              {debugFramePaths.map((path, i) => (
                <div key={i} className="relative group/frame">
                  <img
                    src={path}
                    alt={`Frame ${i}`}
                    className="w-full h-auto rounded border border-zinc-700/50 hover:border-emerald-500/50 transition-colors cursor-pointer"
                    onClick={() => window.open(path, '_blank')}
                  />
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/70 text-zinc-400 px-1 rounded">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={captureStatus === 'idle' || captureStatus === 'saved' ? onStartAutoCapture : onStopCapture}
            className={`flex-1 font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 ${
              captureStatus === 'idle' || captureStatus === 'saved'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                : 'bg-rose-600/90 hover:bg-rose-500 text-white animate-pulse'
            }`}
          >
            {captureStatus === 'idle' || captureStatus === 'saved' ? '自動キャプチャ' : 'キャプチャ停止'}
          </button>

          {(captureStatus === 'done' || captureStatus === 'saved' || captureStatus === 'saving') && (
            <button
              onClick={onResetCapture}
              disabled={captureStatus === 'saving'}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-[0.98] text-sm disabled:opacity-50"
            >
              リセット
            </button>
          )}
        </div>

        {captureStatus === 'saved' && resultImage && (
          <div className="mt-2" ref={previewRef}>
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={onTogglePreviewExpanded}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
              >
                {isPreviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                結合結果プレビュー
              </button>
              {!autoCopyEnabled && (
                <button
                  onClick={() => onCopyImage(resultImage)}
                  className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-[0.98]"
                >
                  <Copy className="w-3.5 h-3.5" /> コピー
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onTogglePreviewExpanded}
              className={`block w-full rounded-xl overflow-hidden transition-all duration-500 cursor-pointer ${isPreviewExpanded ? "aspect-auto" : "aspect-[100/28]"}`}
            >
              <img
                src={resultImage}
                alt="Combined Status"
                className={`w-full h-auto block transition-all duration-500 ${isPreviewExpanded ? "mt-0" : "-mt-[9.5%]"}`}
              />
            </button>
          </div>
        )}
        
        {!umaData && resultImage && (
          <button
            type="button"
            onClick={isOcrProcessing ? onOcrCancel : onOcrStart}
            className={`w-full mt-2 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm ${
              isOcrProcessing
                ? "bg-rose-600/90 hover:bg-rose-500 animate-pulse"
                : "bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500"
            }`}
          >
            {isOcrProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                停止
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 inline-block mr-2" /> 画像からステータスを読込
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
