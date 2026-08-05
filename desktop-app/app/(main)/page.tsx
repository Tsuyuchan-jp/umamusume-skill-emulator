"use client";

import React, { useState, useEffect, useRef } from "react";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Wand2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCapture } from "../hooks/useCapture";
import { useToast } from "../hooks/useToast";
import { ApiKeyModal } from "../components/ApiKeyModal";
import { StatusPanel } from "../components/StatusPanel";
import { SkillPanel } from "../components/SkillPanel";

import { ToastNotification } from "../components/ToastNotification";
import { RaceConditionSelector } from "../components/RaceConditionSelector";
import { analyzeStitchedImage } from "../lib/geminiOcr";
import { migrateFromLocalStorage, saveApiKey } from "../lib/apiKeyStorage";
import { UmaStatusData, SimTab, RaceCondition } from "../lib/types";
import { SimTabPanel } from "./SimTabPanel";
import SimulationStatusView from "../components/SimulationStatusView";
import { CapturePanel } from "../components/CapturePanel";
import { SimulationLauncher } from "../components/SimulationLauncher";
import { TabBar, TabArrivalKind } from "../components/TabBar";
import { RaceInfoLabel } from "../components/RaceInfoLabel";
import { APP_VERSION_LABEL } from "../lib/version";

/** NEW バッジ表示など到着演出の寿命（入場アニメ 600ms より長く保持） */
const TAB_ARRIVAL_CLEAR_MS = 3000;


export default function Home() {
  const {
    captureStatus,
    captureMessage,
    captureError,
    resultImage,
    resultImageFromFile,
    debugFramePaths, // ← 追加
    handleStartAutoCapture,
    handleStopCapture,
    handleResetCapture,
    handleLoadImageFromFile,
  } = useCapture();

  const { showToast, toastMessage, toastType, showToastMessage } = useToast();

  const [autoCopyEnabled, setAutoCopyEnabled] = useState<boolean>(true);
  const [skipStitchedDiskSave, setSkipStitchedDiskSave] = useState<boolean>(false);
  const [saveFolder, setSaveFolder] = useState<string>("");
  const [shortcutKey, setShortcutKey] = useState<string>("F9");
  const [isRecordingShortcut, setIsRecordingShortcut] = useState<boolean>(false);

  // サイドバー寸法（Phase 1 Cockpit）
  const SIDEBAR_COLLAPSED_WIDTH = 56;
  const SIDEBAR_MIN_WIDTH = 350;
  const SIDEBAR_MAX_WIDTH = 480;
  const [sidebarWidth, setSidebarWidth] = useState<number>(380);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const effectiveSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;

  // OCR/エディタ関連ステート
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [umaData, setUmaData] = useState<UmaStatusData | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  /** OCR 中止用。geminiOcr 内では生成せず page が保持する */
  const ocrAbortRef = useRef<AbortController | null>(null);
  /** 遅延成功で古い結果を載せないためのセッション世代 */
  const ocrSessionRef = useRef(0);
  
  // 複数タブ管理用ステート
  const [tabs, setTabs] = useState<SimTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  // Tab Arrival（新タブ到着）— Phase B のヘッダーフラッシュでも同じ state を参照できる
  const [newlyArrivedTabId, setNewlyArrivedTabId] = useState<string | null>(null);
  const [newlyArrivedKind, setNewlyArrivedKind] = useState<TabArrivalKind | null>(null);
  const arrivalClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTabArrived = (tabId: string, kind: TabArrivalKind) => {
    if (arrivalClearTimerRef.current) {
      clearTimeout(arrivalClearTimerRef.current);
    }
    setNewlyArrivedTabId(tabId);
    setNewlyArrivedKind(kind);
    arrivalClearTimerRef.current = setTimeout(() => {
      setNewlyArrivedTabId(null);
      setNewlyArrivedKind(null);
      arrivalClearTimerRef.current = null;
    }, TAB_ARRIVAL_CLEAR_MS);
  };

  useEffect(() => {
    return () => {
      if (arrivalClearTimerRef.current) {
        clearTimeout(arrivalClearTimerRef.current);
      }
    };
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const simDump = activeTab?.simResultDump ?? null;
  const completedRunCount = simDump
    ? (simDump.completedCount ?? simDump.iterations)
    : 0;
  const failedRunCount = simDump?.failedCount ?? 0;
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(true); // プレビューの開閉
  const [isSimulating, setIsSimulating] = useState<boolean>(false); // シミュレーション実行中
  const [simulationCount, setSimulationCount] = useState<number>(100); // シミュレーション回数
  const [simulationProgress, setSimulationProgress] = useState<{current: number, total: number} | null>(null); // 進捗
  const [displayUnit, setDisplayUnit] = useState<'seconds' | 'lengths'>('seconds'); // 差分表示単位

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
      if (newWidth < SIDEBAR_MIN_WIDTH) newWidth = SIDEBAR_MIN_WIDTH;
      if (newWidth > SIDEBAR_MAX_WIDTH) newWidth = SIDEBAR_MAX_WIDTH;
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
    const savedSkipDiskSave = localStorage.getItem("skipStitchedDiskSave");
    if (savedSkipDiskSave !== null) {
      setSkipStitchedDiskSave(savedSkipDiskSave === "true");
    }
    const savedFolder = localStorage.getItem("saveFolder");
    if (savedFolder) {
      setSaveFolder(savedFolder);
    }
    const savedShortcut = localStorage.getItem("shortcutKey");
    if (savedShortcut) {
      setShortcutKey(savedShortcut);
    }
    const initApiKey = async () => {
      try {
        const key = await migrateFromLocalStorage();
        if (key) {
          setApiKey(key);
        }
      } catch (err) {
        console.error("Failed to load API key:", err);
      }
    };
    initApiKey();

    const savedSimCount = localStorage.getItem("simulationCount");
    if (savedSimCount) {
      const parsed = parseInt(savedSimCount, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        setSimulationCount(parsed);
      }
    }
  }, []);

  const handleOcrCancel = () => {
    ocrAbortRef.current?.abort();
  };

  const handleOcrStart = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    if (!resultImage) return;

    // 進行中があれば中止してから新セッションを開始
    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    const session = ++ocrSessionRef.current;

    setIsOcrProcessing(true);
    setUmaData(null);
    showToastMessage("OCR解析中...", "success", 0); // タイマーなしで表示し続ける

    try {
      const res = await analyzeStitchedImage(apiKey, resultImage, { signal: controller.signal });
      // 中止済み、またはより新しい OCR セッションが始まっている場合は結果を捨てる
      if (controller.signal.aborted || session !== ocrSessionRef.current) {
        return;
      }
      setUmaData(res.data);
      showToastMessage("OCR解析が完了しました！", "success", 4000);
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        // 中止は error toast にしない。新しいセッションが既に始まっている場合は上書きしない
        if (session === ocrSessionRef.current) {
          showToastMessage("OCR解析を中止しました", "success", 3000);
        }
        return;
      }
      console.error(err);
      if (session !== ocrSessionRef.current) return;
      if (err.message && (err.message.includes("503") || err.message.includes("UNAVAILABLE"))) {
        showToastMessage("現在AIサーバーが大変混み合っています。数秒待ってからもう一度お試しください。", "error", 4000);
      } else {
        showToastMessage(`OCRエラー: ${err.message}`, "error", 4000);
      }
    } finally {
      // 新しいセッションが始まっている場合は processing を落とさない
      if (session === ocrSessionRef.current) {
        setIsOcrProcessing(false);
        if (ocrAbortRef.current === controller) {
          ocrAbortRef.current = null;
        }
      }
    }
  };

  const handleSaveApiKey = async (key: string) => {
    try {
      await saveApiKey(key);
      setApiKey(key);
      setShowApiKeyModal(false);
      if (captureStatus === "saved" && resultImage) {
        // APIキー保存後にすぐOCRを開始するかはユーザーに任せる
        showToastMessage("APIキーを保存しました。", "success", 3000);
      }
    } catch (err) {
      console.error("Failed to save API key:", err);
      showToastMessage("APIキーの保存に失敗しました。", "error", 3000);
    }
  };

  // 設定の切り替えと保存
  const handleToggleAutoCopy = (enabled: boolean) => {
    setAutoCopyEnabled(enabled);
    localStorage.setItem("autoCopyEnabled", String(enabled));
  };

  const handleToggleSkipStitchedDiskSave = (enabled: boolean) => {
    setSkipStitchedDiskSave(enabled);
    localStorage.setItem("skipStitchedDiskSave", String(enabled));
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

  const handleKeyDownForShortcut = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!isRecordingShortcut) return;
    
    // 単体の修飾キーは無視する
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }
    
    const keys = [];
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
  const copyImageToClipboard = React.useCallback(async (dataUrl: string) => {
    try {
      await invoke("copy_image_to_clipboard", { dataUrl });
      showToastMessage("画像をクリップボードにコピーしました！", "success", 3000);
    } catch (err) {
      console.error("Clipboard copy failed via Rust:", err);
      showToastMessage("コピーに失敗しました。アプリの状態を確認してください。", "error", 3000);
    }
  }, [showToastMessage]);

  // 自動コピーの監視（ファイル由来のプレビューではスキップ）
  useEffect(() => {
    if (captureStatus === "saved" && !autoCopyTriggeredRef.current) {
      autoCopyTriggeredRef.current = true; // このセッションでの自動コピー判定を済みにする
      if (resultImage && autoCopyEnabled && !resultImageFromFile) {
        copyImageToClipboard(resultImage);
      }
    }
  }, [resultImage, captureStatus, autoCopyEnabled, copyImageToClipboard, resultImageFromFile]);

  useEffect(() => {
    // 画像が変わったら OCR 結果を破棄（ファイル差し替え・新規キャプチャ共通）
    // ※ スクロール用 early return の後に置かないこと（差し替え時にクリア漏れになる）
    setUmaData(null);

    if (!resultImage || !previewRef.current) return;
    const timer = setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
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
        style={{ width: `${effectiveSidebarWidth}px` }}
        className={`flex-shrink-0 h-full overflow-hidden bg-zinc-950/40 ${isResizing ? 'select-none pointer-events-none' : ''}`}
      >
        <div className="flex flex-col h-full min-w-0 overflow-hidden">
          {/* 固定ヘッダー（展開/折りたたみ共通・行高を揃える） */}
          <div className="shrink-0 px-4 pt-4 pb-0 overflow-hidden">
            <div className="relative flex items-center gap-3 min-w-0">
              {sidebarCollapsed ? (
                <>
                  {/* 行高維持用ゴースト（装飾なし・即時非表示でフラッシュしない） */}
                  <div className="w-10 h-10 shrink-0" aria-hidden="true" />
                  <h1
                    className="text-base font-extrabold leading-tight tracking-tight min-w-0 flex-1 flex items-baseline truncate whitespace-nowrap opacity-0 pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    <span className="truncate">ウマ娘 レースアナライザー</span>
                    <span className="text-[10px] ml-2 shrink-0">{APP_VERSION_LABEL}</span>
                  </h1>
                  <div className="w-9 h-9 shrink-0" aria-hidden="true" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20 shrink-0">
                    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 10a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 0-4 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"></path>
                    </svg>
                  </div>
                  <h1 className="text-base font-extrabold leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400 min-w-0 flex-1 flex items-baseline truncate whitespace-nowrap">
                    <span className="truncate">ウマ娘 レースアナライザー</span>
                    <span className="text-[10px] text-zinc-500 font-medium ml-2 shrink-0">{APP_VERSION_LABEL}</span>
                  </h1>
                </>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={`flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 transition-colors shrink-0 z-10 ${
                  sidebarCollapsed
                    ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    : "ml-auto"
                }`}
                title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-6 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent min-w-0">
            {/* オートキャプチャ & 自動結合 */}
            <CapturePanel
          statusCfg={statusCfg}
          captureStatus={captureStatus}
          captureMessage={captureMessage}
          captureError={captureError}   // ← 追加
          debugFramePaths={debugFramePaths}  // ← 追加
          resultImage={resultImage}
          umaData={umaData}
          autoCopyEnabled={autoCopyEnabled}
          skipStitchedDiskSave={skipStitchedDiskSave}
          saveFolder={saveFolder}
          shortcutKey={shortcutKey}
          isRecordingShortcut={isRecordingShortcut}
          apiKey={apiKey}
          isPreviewExpanded={isPreviewExpanded}
          isOcrProcessing={isOcrProcessing}
          previewRef={previewRef}
          shortcutInputRef={shortcutInputRef}
          onToggleAutoCopy={handleToggleAutoCopy}
          onToggleSkipStitchedDiskSave={handleToggleSkipStitchedDiskSave}
          onSelectFolder={handleSelectFolder}
          onRecordingShortcutStart={() => setIsRecordingShortcut(true)}
          onRecordingShortcutBlur={() => setIsRecordingShortcut(false)}
          onKeyDownForShortcut={handleKeyDownForShortcut}
          onShowApiKeyModal={() => setShowApiKeyModal(true)}
          onStartAutoCapture={handleStartAutoCapture}
          onStopCapture={handleStopCapture}
          onResetCapture={handleResetCapture}
          onLoadImageFromFile={handleLoadImageFromFile}
          onTogglePreviewExpanded={() => setIsPreviewExpanded(!isPreviewExpanded)}
          onCopyImage={copyImageToClipboard}
          onOcrStart={handleOcrStart}
          onOcrCancel={handleOcrCancel}
        />

        {umaData && (
          <div className="flex flex-col gap-5 animate-fadeIn pb-10">
            {/* 1. コース */}
            <RaceConditionSelector condition={raceCondition} onChange={setRaceCondition} />

            {/* 2. ステータス */}
            <StatusPanel data={umaData} onChange={setUmaData} raceCondition={raceCondition} />

            {/* 3. スキル */}
            <SkillPanel data={umaData} onChange={setUmaData} />

            {/* シミュレーション設定 & 実行 */}
            <SimulationLauncher
              simulationCount={simulationCount}
              setSimulationCount={setSimulationCount}
              isSimulating={isSimulating}
              setIsSimulating={setIsSimulating}
              simulationProgress={simulationProgress}
              setSimulationProgress={setSimulationProgress}
              umaData={umaData}
              raceCondition={raceCondition}
              resultImage={resultImage}
              tabs={tabs}
              setTabs={setTabs}
              setActiveTabId={setActiveTabId}
              onTabArrived={onTabArrived}
              showToastMessage={showToastMessage}
            />
          </div>
        )}
            </div>
          )}
        </div>
      </div>

      {/* Resizer（折りたたみ中は非表示） */}
      {!sidebarCollapsed && (
        <div 
          onMouseDown={() => setIsResizing(true)}
          className="w-1.5 h-full bg-zinc-800/80 hover:bg-emerald-500/50 cursor-col-resize flex-shrink-0 transition-colors z-50 flex items-center justify-center group"
        >
          <div className="h-8 w-0.5 bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors"></div>
        </div>
      )}

      {/* 右カラム (結果アリーナ) */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden min-w-0 p-3 bg-[#09090b] relative ${isResizing ? 'select-none pointer-events-none' : ''}`}>
          {activeTab ? (
            <div className="flex flex-col h-full min-h-0 overflow-hidden animate-fadeIn min-w-0">
              {/* ヘッダー: TabBar + レース情報行 */}
              <div className="shrink-0 min-w-0">
              <TabBar
                tabs={tabs}
                setTabs={setTabs}
                activeTabId={activeTabId}
                setActiveTabId={setActiveTabId}
                newlyArrivedTabId={newlyArrivedTabId}
                newlyArrivedKind={newlyArrivedKind}
              />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 mb-3">
                {/* 案B：光るステータスドット */}
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse ring-4 ring-blue-500/20 ml-1"></div>

                {activeTab && (
                  <div className="flex items-center gap-2">
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
                <span className="ml-auto text-zinc-500 text-sm font-medium min-w-0">
                  <RaceInfoLabel activeTab={activeTab} />
                </span>

                <div className="ml-auto flex items-center gap-3 shrink-0">
                  {/* 完走数（ステータス条件のすぐ左） */}
                  {simDump && (
                    <span
                      className={`text-xs font-mono font-bold whitespace-nowrap px-1 ${
                        failedRunCount > 0 ? 'text-amber-400' : 'text-zinc-600'
                      }`}
                      title={`シミュ完走${completedRunCount.toLocaleString()}走 失敗${failedRunCount.toLocaleString()}走`}
                    >
                      {completedRunCount.toLocaleString()}/{simDump.iterations.toLocaleString()}走
                    </span>
                  )}

                  {/* ステータス確認モーダルボタン */}
                  {activeTab.umaData && activeTab.raceCondition && (
                    <SimulationStatusView umaData={activeTab.umaData} raceCondition={activeTab.raceCondition} />
                  )}

                  {/* 単位切り替えトグル */}
                  <div className="flex items-center bg-zinc-900/80 rounded-lg p-1 border border-zinc-800/50">
                    <button
                    onClick={() => setDisplayUnit('seconds')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      displayUnit === 'seconds' 
                        ? 'bg-blue-500/20 text-blue-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    秒数
                  </button>
                  <button
                    onClick={() => setDisplayUnit('lengths')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      displayUnit === 'lengths' 
                        ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    バ身差
                  </button>
                </div>
              </div>
              </div>
              </div>

              {/* Body: keep-alive タブパネル（sim 済みタブのみ mount） */}
              <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
                {tabs
                  .filter((t) => t.simResultDump)
                  .map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        aria-hidden={!isActive}
                        className={`absolute inset-0 flex flex-col min-h-0 overflow-hidden ${
                          isActive
                            ? "visible z-10"
                            : "invisible z-0 pointer-events-none"
                        }`}
                      >
                        <SimTabPanel
                          tab={tab}
                          displayUnit={displayUnit}
                          isSimulating={isSimulating}
                          simulationCount={simulationCount}
                          setTabs={setTabs}
                          setActiveTabId={setActiveTabId}
                          setIsSimulating={setIsSimulating}
                          setSimulationProgress={setSimulationProgress}
                          onTabArrived={onTabArrived}
                          showToastMessage={showToastMessage}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
              <Wand2 className="w-16 h-16 opacity-30" />
              <p className="text-lg font-bold">結果アリーナ</p>
              <p className="text-sm">左側のパネルで設定を入力し、シミュレーションを実行してください</p>
            </div>
          )}
      </div>
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
