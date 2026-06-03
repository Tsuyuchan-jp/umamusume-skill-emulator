"use client";

import React, { useState, useEffect, useRef } from "react";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Copy, Wand2 } from "lucide-react";
import { useCapture } from "../hooks/useCapture";
import { useToast } from "../hooks/useToast";
import { ApiKeyModal } from "../components/ApiKeyModal";
import { StatusPanel } from "../components/StatusPanel";
import { SkillPanel } from "../components/SkillPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToastNotification } from "../components/ToastNotification";
import { RaceConditionSelector, RaceCondition } from "../components/RaceConditionSelector";
import { analyzeStitchedImage } from "../lib/geminiOcr";
import { UmaStatusData } from "../lib/types";

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

  // OCR/エディタ関連ステート
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [umaData, setUmaData] = useState<UmaStatusData | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

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
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-[#09090b] font-sans text-zinc-100 selection:bg-emerald-500/30">
      <main className="relative z-10 flex flex-1 w-full max-w-4xl flex-col items-center justify-center py-16 px-8 sm:items-start gap-10">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300 hover:bg-emerald-500/20">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 0-4 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"></path>
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                ウマレシートキャプチャ
              </h1>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              因子獲得画面やステータス画面の自動キャプチャ・結合をバックグラウンドで快適に行うためのアシスタントツール。
            </p>
          </div>
        </div>

        {/* オートキャプチャ & 自動結合 */}
        <div className="w-full backdrop-blur-xl bg-zinc-900/20 border border-zinc-800/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_40px_0_rgba(16,185,129,0.06)]">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${statusCfg.color} ${statusCfg.pulse ? 'animate-pulse' : ''}`}></div>
                <h2 className="text-base font-semibold tracking-wide text-zinc-200">オートキャプチャ & 自動結合</h2>
              </div>
              <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${
                captureStatus === 'recording' ? 'text-rose-400 border-rose-500/30 bg-rose-950/30' :
                captureStatus === 'done'      ? 'text-amber-400 border-amber-500/30 bg-amber-950/30' :
                captureStatus === 'saving'    ? 'text-violet-400 border-violet-500/30 bg-violet-950/30' :
                captureStatus === 'saved'     ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30' :
                'text-zinc-500 border-zinc-800 bg-zinc-900/20'
              }`}>
                {statusCfg.label}
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              ゲームの育成完了画面でキャプチャを開始し、因子レシートをスクロールしてください。スクロール終了を自動検知して画像を結合します。
            </p>

            {/* フレームカウンター */}
            {frameCount > 0 && (
              <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-5 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider font-semibold">CAPTURED FRAMES</span>
                  <span className="text-2xl font-black font-mono text-emerald-400 leading-none">{frameCount}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                id="btn-start-auto-capture"
                onClick={handleStartAutoCapture}
                disabled={captureStatus === "recording" || captureStatus === "saving"}
                className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3 text-xs font-semibold text-white shadow-[0_4px_20px_rgba(16,185,129,0.15)] transition-all duration-300 hover:from-emerald-500 hover:to-emerald-600 hover:shadow-[0_4px_25px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {captureStatus === "recording" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      自動録画中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-3.5 h-3.5 text-emerald-100" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>
                      自動キャプチャ
                    </>
                  )}
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-gradient-to-r from-white/10 to-transparent transition-transform duration-500"></div>
              </button>

              <button
                id="btn-start-capture"
                onClick={handleStartCapture}
                disabled={captureStatus === "recording" || captureStatus === "saving"}
                className="relative group overflow-hidden rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 px-5 py-3 text-xs font-semibold text-zinc-100 shadow-md transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg>手動キャプチャ
              </button>

              <button
                id="btn-stop-capture"
                onClick={handleStopCapture}
                disabled={captureStatus !== "recording"}
                className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-rose-600/90 to-rose-700/90 px-5 py-3 text-xs font-semibold text-white shadow-lg transition-all duration-300 hover:from-rose-500 hover:to-rose-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square w-3.5 h-3.5 fill-white text-white" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>手動停止
              </button>
            </div>

            {/* ステータスメッセージ */}
            {captureMessage && !captureError && captureStatus !== "idle" && (
              <div className="animate-fadeIn mt-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[9px] font-semibold text-zinc-500 font-mono tracking-wider">STATUS:</div>
                </div>
                <div className="font-mono text-zinc-300 border border-zinc-800/80 bg-zinc-950/40 rounded-xl p-3 text-xs leading-relaxed">
                  {captureMessage}
                </div>
              </div>
            )}

            {/* SAVED TO */}
            {captureStatus === "saved" && (
              <div className="animate-fadeIn mt-2">
                <div className="text-[9px] font-semibold text-emerald-400/80 mb-1 font-mono tracking-wider">SAVED TO:</div>
                <div className="font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-3 text-xs leading-relaxed break-all">
                  {saveResult}
                </div>
                <button
                  id="btn-reset-capture"
                  onClick={handleResetCapture}
                  className="mt-3 text-xs text-zinc-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw w-3.5 h-3.5 animate-spin-hover" aria-hidden="true">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M8 16H3v5"></path>
                  </svg>
                  リセットして次のキャプチャへ
                </button>
              </div>
            )}

            {/* エラーメッセージ */}
            {captureError && (
              <div className="animate-fadeIn mt-2">
                <div className="font-mono text-rose-400 border border-rose-500/20 bg-rose-950/30 rounded-xl p-3 text-xs leading-relaxed">
                  <span className="text-[9px] font-semibold font-mono tracking-wider text-rose-500 mb-1 block">ERROR:</span>
                  {captureError}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 設定 */}
        <SettingsPanel 
          autoCopyEnabled={autoCopyEnabled}
          saveFolder={saveFolder}
          shortcutKey={shortcutKey}
          isRecordingShortcut={isRecordingShortcut}
          apiKey={apiKey}
          onToggleAutoCopy={handleToggleAutoCopy}
          onSelectFolder={handleSelectFolder}
          onRecordingShortcutStart={() => setIsRecordingShortcut(true)}
          onRecordingShortcutBlur={() => setIsRecordingShortcut(false)}
          onKeyDownForShortcut={handleKeyDownForShortcut as any}
          onShowApiKeyModal={() => setShowApiKeyModal(true)}
          shortcutInputRef={shortcutInputRef as any}
        />
      </main>

      {/* 結合結果の画像プレビューエリア */}
      {resultImage && (
        <div ref={previewRef} className="w-full px-8 pb-16 animate-fadeIn flex flex-col gap-6">
          <div className="bg-zinc-900/40 border border-white/[0.04] rounded-3xl p-6 shadow-lg flex flex-col items-center">
            <div className="flex w-full justify-between items-center mb-6">
              <h2 className="text-lg font-bold tracking-wide text-zinc-200 flex items-center gap-2">
                <span className="text-emerald-400">✨</span> 結合結果プレビュー
              </h2>
              
              {!autoCopyEnabled && (
                <button
                  onClick={() => copyImageToClipboard(resultImage)}
                  className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[13px] font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98] animate-fadeIn"
                >
                  <Copy className="w-4 h-4" /> 画像をコピー
                </button>
              )}
            </div>
            
            <div className="w-full rounded-2xl border border-white/[0.04] bg-black/50 p-3 shadow-inner mb-6">
              <img 
                src={resultImage} 
                alt="Combined Status" 
                className="w-full h-auto object-contain mx-auto rounded-xl shadow-2xl"
              />
            </div>

            {!umaData && (
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={handleOcrStart}
                  disabled={isOcrProcessing}
                  className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                >
                  {isOcrProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      OCRで解析中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" /> 画像からステータスを自動入力する
                    </>
                  )}
                </button>
              </div>
            )}

            {umaData && (
              <div className="w-full mt-4 animate-fadeIn flex flex-col gap-6">
                {/* 1. コース */}
                <RaceConditionSelector 
                  condition={raceCondition} 
                  onChange={setRaceCondition} 
                />

                {/* 2. ステータス */}
                <StatusPanel 
                  data={umaData} 
                  onChange={setUmaData} 
                  raceCondition={raceCondition}
                />

                {/* 3. スキル */}
                <SkillPanel 
                  data={umaData} 
                  onChange={setUmaData} 
                />

                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={async () => {
                      console.log("シミュレーションへ渡すデータ:", umaData);
                      showToastMessage("シミュレーションを開始します...", "success", 3000);
                      try {
                        const { runUmaSimulation } = await import('../lib/engine/umaemuAdapter');
                        const simResult = await runUmaSimulation(umaData, raceCondition);
                        console.log("シミュレーション結果:", simResult);
                        showToastMessage(`シミュレーション完了！タイム: ${simResult.raceTime.toFixed(3)}秒`, "success", 5000);
                      } catch (e: any) {
                        console.error(e);
                        showToastMessage(`シミュレーションエラー: ${e.message}`, "error", 5000);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
                  >
                    ✅ 確定してシミュレーションを開始
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* トースト通知 */}
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
