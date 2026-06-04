"use client";

import React, { useState, useEffect, useRef } from "react";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Copy, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { useCapture } from "../hooks/useCapture";
import { useToast } from "../hooks/useToast";
import { ApiKeyModal } from "../components/ApiKeyModal";
import { StatusPanel } from "../components/StatusPanel";
import { SkillPanel } from "../components/SkillPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToastNotification } from "../components/ToastNotification";
import { RaceConditionSelector, RaceCondition } from "../components/RaceConditionSelector";
import { analyzeStitchedImage } from "../lib/geminiOcr";
import { UmaStatusData, SimTab } from "../lib/types";
import { ResultCard } from "../components/ResultCard";
import { SkillVerifier } from "../components/SkillVerifier";
import SimulationStatusView from "../components/SimulationStatusView";
import { trackData } from "../lib/trackData";

export default function Home() {
  const {
    captureStatus,
    frameCount,
    captureMessage,
    saveResult,
    captureError,
    resultImage,
    handleStartCapture,
    handleStartAutoCapture,
    handleStopCapture,
    handleResetCapture,
  } = useCapture();

  const { showToast, toastMessage, toastType, showToastMessage } = useToast();

  const [autoCopyEnabled, setAutoCopyEnabled] = useState<boolean>(true);
  const [saveFolder, setSaveFolder] = useState<string>("");
  const [shortcutKey, setShortcutKey] = useState<string>("F9");
  const [isRecordingShortcut, setIsRecordingShortcut] = useState<boolean>(false);

  // リサイズ用ステート
  const [sidebarWidth, setSidebarWidth] = useState<number>(450);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // OCR/エディタ関連ステート
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [umaData, setUmaData] = useState<UmaStatusData | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  
  // 複数タブ管理用ステート
  const [tabs, setTabs] = useState<SimTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(true); // プレビューの開閉
  const [isSimulating, setIsSimulating] = useState<boolean>(false); // シミュレーション実行中
  const [simulationCount, setSimulationCount] = useState<number>(100); // シミュレーション回数
  const [simulationProgress, setSimulationProgress] = useState<{current: number, total: number} | null>(null); // 進捗

  // アニメーション用ステート
  const [flyingThumbnail, setFlyingThumbnail] = useState<{ src: string, rect: DOMRect } | null>(null);
  const [highlightedTabId, setHighlightedTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // リネーム用ステート
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");

  // レース環境ステート
  const [raceCondition, setRaceCondition] = useState<RaceCondition>({
    locationId: "10006",
    courseId: "10606", // デフォルト: 東京 芝2400m
    surfaceCond: 1, // 良
    playerNum: 9
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const autoCopyTriggeredRef = useRef<boolean>(false);
  const shortcutInputRef = useRef<HTMLInputElement>(null);

  const captureStatusRef = useRef(captureStatus);
  const handleStartAutoCaptureRef = useRef(handleStartAutoCapture);
  const handleStopCaptureRef = useRef(handleStopCapture);
  const isRecordingShortcutRef = useRef(isRecordingShortcut);

  useEffect(() => { captureStatusRef.current = captureStatus; }, [captureStatus]);
  useEffect(() => { handleStartAutoCaptureRef.current = handleStartAutoCapture; }, [handleStartAutoCapture]);
  useEffect(() => { handleStopCaptureRef.current = handleStopCapture; }, [handleStopCapture]);
  useEffect(() => { isRecordingShortcutRef.current = isRecordingShortcut; }, [isRecordingShortcut]);

  // リサイザー用のイベントハンドラ
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 450) newWidth = 450; // 最小幅
      if (newWidth > 800) newWidth = 800; // 最大幅
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // ショートカット変更モードに入った時の自動フォーカス処理
  useEffect(() => {
    if (isRecordingShortcut) {
      shortcutInputRef.current?.focus();
    }
  }, [isRecordingShortcut]);

  // キャプチャ開始時や初期化（idle）時に実行済みフラグをリセット
  useEffect(() => {
    if (captureStatus === "recording" || captureStatus === "idle") {
      autoCopyTriggeredRef.current = false;
    }
  }, [captureStatus]);

  // オーバーレイへのステータス通知と表示制御
  useEffect(() => {
    const notifyOverlay = async () => {
      try {
        if (captureStatus === "recording") {
          await invoke("show_overlay");
        }
        const msg = captureError || captureMessage;
        await emit("overlay-status", { status: captureStatus, message: msg });
      } catch (err) {
        console.error("Failed to notify overlay:", err);
      }
    };
    notifyOverlay();
  }, [captureStatus, captureMessage, captureError]);

  // LocalStorageから設定をロードし、オーバーレイを事前生成する
  useEffect(() => {
    const initOverlay = async () => {
      try {
        await invoke("init_overlay");
      } catch (err) {
        console.error("Failed to initialize overlay:", err);
      }
    };
    initOverlay();
    
    const savedAutoCopy = localStorage.getItem("autoCopyEnabled");
    if (savedAutoCopy !== null) {
      setAutoCopyEnabled(savedAutoCopy === "true");
    }
    const savedFolder = localStorage.getItem("saveFolder");
    if (savedFolder) {
      setSaveFolder(savedFolder);
    }
    const savedShortcut = localStorage.getItem("shortcutKey");
    if (savedShortcut) {
      setShortcutKey(savedShortcut);
    }
    const savedApiKey = localStorage.getItem("geminiApiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    const savedSimCount = localStorage.getItem("simulationCount");
    if (savedSimCount) {
      setSimulationCount(parseInt(savedSimCount, 10));
    }
  }, []);

  const handleOcrStart = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    if (!resultImage) return;

    setIsOcrProcessing(true);
    setUmaData(null);
    showToastMessage("OCR解析中...", "success", 0); // タイマーなしで表示し続ける

    try {
      const res = await analyzeStitchedImage(apiKey, resultImage);
      setUmaData(res.data);
      showToastMessage(`OCR解析が完了しました！(モデル: ${res.modelUsed})`, "success", 4000);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("503") || err.message.includes("UNAVAILABLE"))) {
        showToastMessage("現在AIサーバーが大変混み合っています。数秒待ってからもう一度お試しください。", "error", 4000);
      } else {
        showToastMessage(`OCRエラー: ${err.message}`, "error", 4000);
      }
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("geminiApiKey", key);
    setShowApiKeyModal(false);
    if (captureStatus === "saved" && resultImage) {
      // APIキー保存後にすぐOCRを開始するかはユーザーに任せる
      showToastMessage("APIキーを保存しました。", "success", 3000);
    }
  };

  // 設定の切り替えと保存
  const handleToggleAutoCopy = (enabled: boolean) => {
    setAutoCopyEnabled(enabled);
    localStorage.setItem("autoCopyEnabled", String(enabled));
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setSaveFolder(selected);
        localStorage.setItem("saveFolder", selected);
      }
    } catch (err) {
      console.error("Failed to open dialog:", err);
    }
  };

  const handleKeyDownForShortcut = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (!isRecordingShortcut) return;
    
    // 単体の修飾キーは無視する
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }
    
    let keys = [];
    if (e.ctrlKey || e.metaKey) keys.push("CommandOrControl");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    
    let key = e.key;
    if (key === " ") key = "Space";
    else if (key.length === 1) key = key.toUpperCase();
    
    keys.push(key);
    
    const newShortcut = keys.join("+");
    setShortcutKey(newShortcut);
    localStorage.setItem("shortcutKey", newShortcut);
    setIsRecordingShortcut(false);
  };

  const handleRenameTab = (tabId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: trimmed } : t));
    }
    setEditingTabId(null);
  };

  // ショートカットキーの登録・更新処理
  useEffect(() => {
    if (!shortcutKey) return;
    
    let isShortcutRegisteredLocally = false;
    const setupShortcut = async () => {
      try {
        // バックエンドに既に登録されている場合は、一度安全に解除する
        const alreadyRegistered = await isRegistered(shortcutKey);
        if (alreadyRegistered) {
          await unregister(shortcutKey);
        }

        await register(shortcutKey, (event) => {
          if (event.state === "Pressed") {
            if (isRecordingShortcutRef.current) return;
            
            if (captureStatusRef.current === "idle" || captureStatusRef.current === "saved") {
              handleStartAutoCaptureRef.current();
            } else if (captureStatusRef.current === "recording") {
              handleStopCaptureRef.current();
            }
          }
        });
        isShortcutRegisteredLocally = true;
      } catch (err) {
        console.error("Failed to register shortcut:", err);
      }
    };
    setupShortcut();

    return () => {
      if (isShortcutRegisteredLocally) {
        unregister(shortcutKey).catch(console.error);
      }
    };
  }, [shortcutKey]);

  // 画像をクリップボードにコピーする共通関数
  const copyImageToClipboard = async (dataUrl: string) => {
    try {
      await invoke("copy_image_to_clipboard", { dataUrl });
      showToastMessage("画像をクリップボードにコピーしました！", "success", 3000);
    } catch (err) {
      console.error("Clipboard copy failed via Rust:", err);
      showToastMessage("コピーに失敗しました。アプリの状態を確認してください。", "error", 3000);
    }
  };

  // 自動コピーの監視
  useEffect(() => {
    if (captureStatus === "saved" && !autoCopyTriggeredRef.current) {
      autoCopyTriggeredRef.current = true; // このセッションでの自動コピー判定を済みにする
      if (resultImage && autoCopyEnabled) {
        copyImageToClipboard(resultImage);
      }
    }
  }, [resultImage, captureStatus, autoCopyEnabled]);

  useEffect(() => {
    if (resultImage && previewRef.current) {
      // 少し遅延を入れてからスクロールする（DOMレンダリングを確実にするため）
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    // キャプチャが新しくなったらOCR結果をリセット
    setUmaData(null);
  }, [resultImage]);

  const captureStatusConfig = {
    idle: { color: "bg-zinc-500", pulse: false, label: "待機中" },
    recording: { color: "bg-rose-500", pulse: true, label: "録画中" },
    done: { color: "bg-amber-400", pulse: false, label: "取得完了" },
    saving: { color: "bg-violet-400", pulse: true, label: "結合中" },
    saved: { color: "bg-emerald-400", pulse: false, label: "保存完了" },
  };

  const statusCfg = captureStatusConfig[captureStatus];

  return (
    <div className="flex w-full h-screen bg-[#09090b] font-sans text-zinc-100 selection:bg-emerald-500/30 overflow-hidden">
      {/* 左カラム (コントロールパネル) */}
      <div 
        style={{ width: `${sidebarWidth}px` }}
        className={`flex-shrink-0 h-full overflow-y-auto bg-zinc-950/40 p-6 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent ${isResizing ? 'select-none pointer-events-none' : ''}`}
      >
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300 hover:bg-emerald-500/20 shrink-0">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 0-4 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"></path>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400 shrink-0">
            ウマ娘 レースアナライザー
          </h1>
        </div>

        {/* オートキャプチャ & 自動結合 */}
        <div className="w-full backdrop-blur-xl bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${statusCfg.color} ${statusCfg.pulse ? 'animate-pulse' : ''}`}></div>
                <h2 className="text-sm font-semibold tracking-wide text-zinc-200">画面キャプチャ連携</h2>
              </div>
              <SettingsPanel
                autoCopyEnabled={autoCopyEnabled}
                onToggleAutoCopy={handleToggleAutoCopy}
                saveFolder={saveFolder}
                onSelectFolder={handleSelectFolder}
                shortcutKey={shortcutKey}
                isRecordingShortcut={isRecordingShortcut}
                onRecordingShortcutStart={() => setIsRecordingShortcut(true)}
                onRecordingShortcutBlur={() => setIsRecordingShortcut(false)}
                onKeyDownForShortcut={handleKeyDownForShortcut as any}
                shortcutInputRef={shortcutInputRef as any}
                apiKey={apiKey}
                onShowApiKeyModal={() => setShowApiKeyModal(true)}
              />
            </div>

            <p className="text-xs text-zinc-400">{captureMessage}</p>

            <div className="flex items-center gap-2">
              <button
                onClick={captureStatus === 'idle' || captureStatus === 'saved' ? handleStartAutoCapture : handleStopCapture}
                className={`flex-1 font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 ${
                  captureStatus === 'idle' || captureStatus === 'saved'
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    : 'bg-rose-600/90 hover:bg-rose-500 text-white animate-pulse'
                }`}
              >
                {captureStatus === 'idle' || captureStatus === 'saved' ? '自動キャプチャ' : '録画停止'}
              </button>

              {(captureStatus === 'done' || captureStatus === 'saved' || captureStatus === 'saving') && (
                <button
                  onClick={handleResetCapture}
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
                    onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
                  >
                    {isPreviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    結合結果プレビュー
                  </button>
                  {!autoCopyEnabled && (
                    <button
                      onClick={() => copyImageToClipboard(resultImage)}
                      className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" /> コピー
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="block w-full rounded-xl border border-white/[0.04] bg-black/50 p-2 shadow-inner transition-all duration-500 cursor-pointer hover:border-white/[0.1]"
                >
                  <div className={`w-full relative overflow-hidden rounded-lg transition-all duration-500 ${isPreviewExpanded ? 'aspect-auto' : 'aspect-[100/28]'}`}>
                    <img 
                      src={resultImage} 
                      alt="Combined Status" 
                      className={`w-full h-auto block transition-all duration-500 ${isPreviewExpanded ? 'mt-0' : '-mt-[9.5%]'}`} 
                    />
                  </div>
                </button>
              </div>
            )}
            
            {!umaData && resultImage && (
              <button
                onClick={handleOcrStart}
                disabled={isOcrProcessing}
                className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] text-sm"
              >
                {isOcrProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    解析中...
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

        {umaData && (
          <div className="flex flex-col gap-5 animate-fadeIn pb-10">
            {/* 1. コース */}
            <RaceConditionSelector condition={raceCondition} onChange={setRaceCondition} />

            {/* 2. ステータス */}
            <StatusPanel data={umaData} onChange={setUmaData} raceCondition={raceCondition} />

            {/* 3. スキル */}
            <SkillPanel data={umaData} onChange={setUmaData} />

            {/* シミュレーション設定 & 実行 */}
            <div className="flex flex-col gap-3 sticky bottom-0 z-20 pb-4 bg-[#09090b] pt-4 border-t border-zinc-900/50">
              <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 backdrop-blur-md">
                <span className="text-sm font-bold text-zinc-300 whitespace-nowrap">試行回数</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={simulationCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    setSimulationCount(val);
                    localStorage.setItem("simulationCount", val.toString());
                  }}
                  className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 w-24 font-mono font-bold"
                />
                <div className="flex items-center gap-1.5 ml-auto">
                  {[100, 1000, 10000].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setSimulationCount(num);
                        localStorage.setItem("simulationCount", num.toString());
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        simulationCount === num
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {num.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!umaData) return;
                  if (!umaData.strategy || umaData.strategy === "") {
                    showToastMessage("作戦が未選択です。ステータス枠から作戦を選択してください！", "error", 5000);
                    return;
                  }
                  setIsSimulating(true);
                  setSimulationProgress({ current: 0, total: simulationCount });
                  showToastMessage(`${simulationCount.toLocaleString()}回シミュレーションを実行中...`, 'success', 3000);
                  try {
                    const { runMultipleSimulations } = await import('../lib/engine/umaemuAdapter');
                    const simResult = await runMultipleSimulations(
                      umaData, 
                      raceCondition, 
                      simulationCount,
                      (current, total) => setSimulationProgress({ current, total })
                    );
                  
                  // サムネイル画像の生成
                  let thumbUrl = null;
                  if (resultImage) {
                    const { cropThumbnail } = await import('../lib/imageUtils');
                    thumbUrl = await cropThumbnail(resultImage);
                  }

                  // タブを追加
                  const newTabId = Date.now().toString();
                  const newTab: SimTab = {
                    id: newTabId,
                    title: umaData.name || `ウマ娘 ${tabs.length + 1}`,
                    umaData: { ...umaData },
                    raceCondition: { ...raceCondition },
                    simResultDump: simResult,
                    baselineResult: simResult,
                    disabledSkills: [],
                    thumbnailUrl: thumbUrl
                  };
                  
                  setTabs(prev => [...prev, newTab]);
                  setActiveTabId(newTabId);
                  
                  showToastMessage(`${simulationCount.toLocaleString()}回のシミュレーションが完了しました！`, 'success', 5000);
                } catch (e: any) {
                  console.error("Simulation error:", e);
                  const msg = e && e.message ? e.message : String(e);
                  showToastMessage(`シミュレーションエラー: ${msg}`, 'error', 5000);
                } finally {
                  setIsSimulating(false);
                  setSimulationProgress(null);
                }
              }}
              disabled={isSimulating}
              className="relative overflow-hidden w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSimulating && simulationProgress && (
                <div 
                  className="absolute inset-y-0 left-0 bg-emerald-400/50 transition-all duration-100 ease-linear"
                  style={{ width: `${(simulationProgress.current / simulationProgress.total) * 100}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                {isSimulating && simulationProgress 
                  ? `実行中... ${Math.floor((simulationProgress.current / simulationProgress.total) * 100)}% (${simulationProgress.current.toLocaleString()} / ${simulationProgress.total.toLocaleString()})` 
                  : `🚀 ${simulationCount.toLocaleString()}回シミュレーションを実行`}
              </span>
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Resizer */}
      <div 
        onMouseDown={() => setIsResizing(true)}
        className="w-1.5 h-full bg-zinc-800/80 hover:bg-emerald-500/50 cursor-col-resize flex-shrink-0 transition-colors z-50 flex items-center justify-center group"
      >
        <div className="h-8 w-0.5 bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors"></div>
      </div>

      {/* 右カラム (結果アリーナ) */}
      <div ref={scrollContainerRef} className={`flex-1 h-full overflow-y-auto p-10 bg-[#09090b] relative scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent ${isResizing ? 'select-none pointer-events-none' : ''}`}>
        <div className="max-w-5xl mx-auto h-full">
          {activeTab ? (
            <div className="animate-fadeIn">
              {/* Tab Bar UI */}
              <div className="flex gap-3 mb-6 border-b border-zinc-800 pb-4 overflow-x-auto scrollbar-thin">
                {tabs.map(tab => {
                  const isActive = activeTabId === tab.id;
                  return (
                    <div 
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300 h-16 ${
                        isActive 
                          ? 'border-emerald-500 w-56 opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10' 
                          : 'border-transparent w-48 opacity-60 hover:opacity-100 hover:border-zinc-700'
                      } ${highlightedTabId === tab.id ? 'ring-4 ring-emerald-400 animate-pulse' : ''}`}
                    >
                      {tab.thumbnailUrl ? (
                        <div className="w-full h-full relative bg-zinc-900 pointer-events-none">
                          <img 
                            src={tab.thumbnailUrl} 
                            alt={tab.title} 
                            className="w-full h-full object-cover"
                          />
                          <div className={`absolute inset-0 transition-opacity ${isActive ? 'bg-black/0' : 'bg-black/50 group-hover:bg-black/20'}`}></div>
                          {tab.isDuplicate && (
                            <div className="absolute top-1 left-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">
                              🎨 コピー
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <span className="text-sm font-bold text-zinc-400">{tab.title}</span>
                        </div>
                      )}
                      
                      {/* Close button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTabs(prev => prev.filter(t => t.id !== tab.id));
                          if (activeTabId === tab.id) {
                            const remaining = tabs.filter(t => t.id !== tab.id);
                            setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
                          }
                        }}
                        className={`absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white backdrop-blur-md`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-zinc-100">シミュレーション結果</h2>
                {activeTab && (
                  <div className="flex items-center gap-2 ml-2">
                    {editingTabId === activeTab.id ? (
                      <input
                        type="text"
                        autoFocus
                        className="text-sm font-bold text-zinc-200 bg-zinc-800 px-3 py-1 rounded-full border border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-48"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRenameTab(activeTab.id, editTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTab(activeTab.id, editTitle);
                          if (e.key === 'Escape') setEditingTabId(null);
                        }}
                      />
                    ) : (
                      <span 
                        className="group flex items-center cursor-pointer text-sm font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full border border-zinc-700/50 transition-all duration-300"
                        onClick={() => {
                          setEditTitle(activeTab.title);
                          setEditingTabId(activeTab.id);
                        }}
                        title="クリックしてタブの名前を変更"
                      >
                        {activeTab.title}
                        <span className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-[20px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out text-[10px]">✏️</span>
                      </span>
                    )}
                    {activeTab.isDuplicate && (
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 tracking-wider">
                        🎨 コピー
                      </span>
                    )}
                  </div>
                )}
                <span className="ml-auto text-zinc-500 text-sm font-medium">
                  {(() => {
                    if (!activeTab || !activeTab.raceCondition) return "東京 芝 2400m / 100走";
                    const cond = activeTab.raceCondition;
                    const uma = activeTab.umaData;
                    const loc = trackData.find(l => l.id === cond.locationId);
                    const course = loc?.courses.find(c => c.id === cond.courseId);
                    const SURFACE_MAP: Record<number, string> = { 1: '良', 2: '稍重', 3: '重', 4: '不良' };
                    const CONDITION_MAP: Record<string, string> = { "BEST": "絶好調", "GOOD": "好調", "NORMAL": "普通", "BAD": "不調", "WORST": "絶不調" };
                    
                    const parts = [];
                    if (loc && course) parts.push(`${loc.name} ${course.name}`);
                    if (SURFACE_MAP[cond.surfaceCond]) parts.push(SURFACE_MAP[cond.surfaceCond]);
                    if (cond.playerNum) parts.push(`${cond.playerNum}人`);
                    
                    const runCount = activeTab.simResultDump?.length || simulationCount;
                    parts.push(`${runCount.toLocaleString()}走`);
                    return parts.join(' / ');
                  })()}
                </span>
              </div>
              <ResultCard result={activeTab.simResultDump} baseline={activeTab.baselineResult} />

              {/* 実行時ステータス表示 */}
              {activeTab.umaData && activeTab.raceCondition && (
                <SimulationStatusView umaData={activeTab.umaData} raceCondition={activeTab.raceCondition} />
              )}

              {/* スキル影響検証モード */}
              {activeTab.umaData && activeTab.baselineResult && (
                <SkillVerifier
                  umaData={activeTab.umaData}
                  disabledSkills={activeTab.disabledSkills}
                  onToggleSkill={(skillName) => {
                    setTabs(prev => prev.map(t => {
                      if (t.id === activeTabId) {
                        return {
                          ...t,
                          disabledSkills: t.disabledSkills.includes(skillName)
                            ? t.disabledSkills.filter(s => s !== skillName)
                            : [...t.disabledSkills, skillName]
                        };
                      }
                      return t;
                    }));
                  }}
                  isSimulating={isSimulating}
                  onResetSkills={() => {
                    setTabs(prev => prev.map(t => {
                      if (t.id === activeTabId) {
                        return {
                          ...t,
                          disabledSkills: [],
                          simResultDump: t.baselineResult
                        };
                      }
                      return t;
                    }));
                    showToastMessage("スキル構成と結果を初期状態にリセットしました", "success", 3000);
                  }}
                  onDuplicateTab={(rect?: DOMRect) => {
                    if (!activeTab) return;
                    
                    const newTab = {
                      ...activeTab,
                      id: Date.now().toString(),
                      isDuplicate: true
                    };
                    
                    setTabs(prev => [...prev, newTab]);
                    setActiveTabId(newTab.id);

                    if (rect && activeTab.thumbnailUrl) {
                      setFlyingThumbnail({ src: activeTab.thumbnailUrl, rect });
                      if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                      setHighlightedTabId(newTab.id);
                      
                      setTimeout(() => {
                        setFlyingThumbnail(null);
                      }, 700);
                      
                      setTimeout(() => {
                        setHighlightedTabId(null);
                      }, 2000);
                    } else {
                      showToastMessage(`タブを複製しました`, "success", 3000);
                    }
                  }}
                  onRunComparativeSimulation={async () => {
                    if (!activeTab.umaData) return;
                    setIsSimulating(true);
                    setSimulationProgress({ current: 0, total: simulationCount });
                    showToastMessage('検証シミュレーションを実行中...', 'success', 3000);
                    try {
                      const { runMultipleSimulations } = await import('../lib/engine/umaemuAdapter');
                      const clonedUmaData = {
                        ...activeTab.umaData,
                        skills: activeTab.umaData.skills.filter(s => !activeTab.disabledSkills.includes(s))
                      };
                      const simResult = await runMultipleSimulations(
                        clonedUmaData, 
                        raceCondition, 
                        simulationCount,
                        (current, total) => setSimulationProgress({ current, total })
                      );
                      
                      setTabs(prev => prev.map(t => {
                        if (t.id === activeTabId) {
                          return { ...t, simResultDump: simResult };
                        }
                        return t;
                      }));
                      
                      showToastMessage(`比較検証が完了しました！`, 'success', 5000);
                    } catch (e: any) {
                      console.error("Verification error:", e);
                      const msg = e && e.message ? e.message : String(e);
                      showToastMessage(`検証エラー: ${msg}`, 'error', 5000);
                    } finally {
                      setIsSimulating(false);
                      setSimulationProgress(null);
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
              <Wand2 className="w-16 h-16 opacity-30" />
              <p className="text-lg font-bold">結果アリーナ</p>
              <p className="text-sm">左側のパネルで設定を入力し、シミュレーションを実行してください</p>
            </div>
          )}
        </div>
      </div>
      {/* 飛翔アニメーション用要素 */}
      {flyingThumbnail && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-xl overflow-hidden shadow-2xl shadow-emerald-500/50 border-2 border-emerald-400"
          style={{
            left: flyingThumbnail.rect.left,
            top: flyingThumbnail.rect.top,
            width: flyingThumbnail.rect.width,
            height: flyingThumbnail.rect.height,
            animation: 'flyToTab 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <img src={flyingThumbnail.src} className="w-full h-full object-cover" />
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flyToTab {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-80vh) scale(0.1);
            opacity: 0;
          }
        }
      `}} />

      {/* トースト通知 & モーダル */}
      <ToastNotification show={showToast} type={toastType} message={toastMessage} />
      <ApiKeyModal
        isOpen={showApiKeyModal}
        initialKey={apiKey}
        onSave={handleSaveApiKey}
        onClose={() => setShowApiKeyModal(false)}
      />
    </div>
  );
}
