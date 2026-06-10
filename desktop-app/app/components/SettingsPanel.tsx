import { Folder, Keyboard, Settings, Key } from "lucide-react";

interface SettingsPanelProps {
  autoCopyEnabled: boolean;
  saveFolder: string;
  shortcutKey: string;
  isRecordingShortcut: boolean;
  apiKey: string;
  onToggleAutoCopy: (enabled: boolean) => void;
  onSelectFolder: () => void;
  onRecordingShortcutStart: () => void;
  onRecordingShortcutBlur: () => void;
  onKeyDownForShortcut: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onShowApiKeyModal: () => void;
  shortcutInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SettingsPanel({
  autoCopyEnabled,
  saveFolder,
  shortcutKey,
  isRecordingShortcut,
  apiKey,
  onToggleAutoCopy,
  onSelectFolder,
  onRecordingShortcutStart,
  onRecordingShortcutBlur,
  onKeyDownForShortcut,
  onShowApiKeyModal,
  shortcutInputRef
}: SettingsPanelProps) {
  return (
    <div className="w-full backdrop-blur-xl bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 px-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-500 hover:border-emerald-500/20 hover:shadow-[0_0_30px_0_rgba(16,185,129,0.03)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-300 flex items-center gap-2 whitespace-nowrap">
            <Settings className="w-4 h-4 text-emerald-400" /> 設定
          </h2>
          <label
            className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-300 transition-colors group w-fit"
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
            <span>自動コピー</span>
          </label>
        </div>
        
        <div className="h-px w-full bg-white/[0.05]"></div>
        
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5 w-full">
            <span className="text-xs font-medium text-zinc-300">画像の保存先フォルダ</span>
            <span className="text-[10px] text-zinc-500">未設定時は標準ダウンロードフォルダ</span>
          </div>
          <div className="flex w-full min-w-0 items-center bg-zinc-950/50 border border-zinc-800/80 rounded-lg overflow-hidden group focus-within:border-emerald-500/50 transition-colors">
            <div className="pl-3 pr-2 text-zinc-500 shrink-0">
              <Folder className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <input 
              type="text" 
              readOnly 
              placeholder="未設定" 
              className="flex-1 bg-transparent py-2 text-xs text-zinc-300 outline-none truncate min-w-0" 
              title={saveFolder || "標準のダウンロードフォルダ"} 
              value={saveFolder}
            />
            <button 
              onClick={onSelectFolder}
              className="shrink-0 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2 border-l border-zinc-700/50 transition-all active:bg-emerald-700"
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
              className={`flex-1 bg-transparent py-2 text-xs outline-none truncate min-w-0 transition-colors ${isRecordingShortcut ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`} 
            />
            <button 
              onClick={onRecordingShortcutStart}
              className={`shrink-0 text-xs font-semibold px-4 py-2 border-l border-zinc-700/50 transition-all ${isRecordingShortcut ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white active:bg-emerald-700'}`}
            >
              {isRecordingShortcut ? "入力中" : "変更"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.05]">
          <div className="flex flex-col gap-0.5 w-full">
            <span className="text-xs font-medium text-zinc-300">Gemini APIキー</span>
            <span className="text-[10px] text-zinc-500">OCR解析用</span>
          </div>
          <div className="flex w-full min-w-0 items-center">
            <button
              onClick={onShowApiKeyModal}
              className="shrink-0 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-xs font-semibold px-4 py-2 border border-zinc-700/50 rounded-lg transition-all active:bg-emerald-700 flex items-center gap-2"
            >
              <Key className="w-3.5 h-3.5" />
              {apiKey ? "設定済み" : "未設定"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
