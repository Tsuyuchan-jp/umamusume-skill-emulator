import re
with open("desktop-app/app/(main)/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if 'import { ResultCard }' not in content:
    content = content.replace('import { UmaStatusData } from "../lib/types";', 'import { UmaStatusData } from "../lib/types";\nimport { ResultCard } from "../components/ResultCard";')

# Find "return ("
idx = content.find("  return (")
if idx == -1:
    print("Not found")
    exit(1)

new_return = """  return (
    <div className="flex w-full h-screen bg-[#09090b] font-sans text-zinc-100 selection:bg-emerald-500/30 overflow-hidden">
      {/* 左カラム (コントロールパネル) */}
      <div className="w-[450px] flex-shrink-0 h-full overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/40 p-6 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300 hover:bg-emerald-500/20">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 0-4 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"></path>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
            ウマレシートキャプチャ
          </h1>
        </div>

        {/* オートキャプチャ & 自動結合 */}
        <div className="w-full backdrop-blur-xl bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
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
                onStartRecordShortcut={() => {
                  setIsRecordingShortcut(true);
                  if (shortcutInputRef.current) shortcutInputRef.current.focus();
                }}
                onKeyDownShortcut={handleKeyDownForShortcut as any}
                shortcutInputRef={shortcutInputRef as any}
                apiKey={apiKey}
                onOpenApiKeyModal={() => setShowApiKeyModal(true)}
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
                {captureStatus === 'idle' || captureStatus === 'saved' ? '録画待機' : '録画停止'}
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
                  <h2 className="text-xs font-bold text-zinc-300">結合結果</h2>
                  {!autoCopyEnabled && (
                    <button
                      onClick={() => copyImageToClipboard(resultImage)}
                      className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" /> コピー
                    </button>
                  )}
                </div>
                <div className="w-full rounded-xl border border-white/[0.04] bg-black/50 p-2 shadow-inner">
                  <img src={resultImage} alt="Combined Status" className="w-full h-auto object-contain mx-auto rounded-lg" />
                </div>
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

            <button
              onClick={async () => {
                showToastMessage('100回シミュレーションを実行中...', 'success', 3000);
                try {
                  const { runMultipleSimulations } = await import('../lib/engine/umaemuAdapter');
                  const simResult = await runMultipleSimulations(umaData, raceCondition, 100);
                  setSimResultDump(simResult);
                  showToastMessage(`100回のシミュレーションが完了しました！`, 'success', 5000);
                } catch (e: any) {
                  console.error(e);
                  showToastMessage(`シミュレーションエラー: ${e.message}`, 'error', 5000);
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 sticky bottom-0 z-20"
            >
              🚀 100回シミュレーションを実行
            </button>
          </div>
        )}
      </div>

      {/* 右カラム (結果アリーナ) */}
      <div className="flex-1 h-full overflow-y-auto p-10 bg-[#09090b] relative scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="max-w-5xl mx-auto h-full">
          {simResultDump ? (
            <div className="animate-fadeIn">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-zinc-100">シミュレーション結果</h2>
                <span className="ml-auto text-zinc-500 text-sm">東京 芝 2400m / 100走</span>
              </div>
              <ResultCard result={simResultDump} />
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
"""

with open("desktop-app/app/(main)/page.tsx", "w", encoding="utf-8") as f:
    f.write(content[:idx] + new_return)
print("done")
