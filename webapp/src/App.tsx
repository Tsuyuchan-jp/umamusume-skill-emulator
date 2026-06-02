import React, { useState, useEffect } from 'react';
import { useCapture } from './hooks/useCapture';
import { analyzeImageWithGemini } from './lib/geminiOcr';
import { UmaStatusData } from './lib/types';
import { StatusEditor } from './components/StatusEditor';
import ApiKeyModal from './components/ApiKeyModal';
import './App.css';

function App() {
  const {
    captureStatus,
    captureMessage,
    captureError,
    resultImage,
    handleStartCapture,
    handleStopCapture,
    handleSaveAndCopy
  } = useCapture();

  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<UmaStatusData | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setIsApiKeyModalOpen(true);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    setIsApiKeyModalOpen(false);
  };

  const handleAnalyzeImage = async () => {
    if (!resultImage) return;
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const data = await analyzeImageWithGemini(resultImage, apiKey);
      setParsedData(data);
    } catch (error: any) {
      console.error(error);
      alert('解析エラー: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditorSave = (data: UmaStatusData) => {
    console.log("Saving to simulator context: ", data);
    setParsedData(null);
    alert("シミュレーターへデータを送信しました！（※フェーズ1との統合は別途実施）");
  };

  return (
    <div className="app-container">
      <header>
        <h1>Uma Skill Emulator Input</h1>
      </header>

      <div className="main-content">
        {!parsedData ? (
          <>
            <section className="capture-section">
              <h2>1. 画面キャプチャ（詳細ステータス画面をスクロール）</h2>
              <div className="controls">
                {captureStatus === 'idle' || captureStatus === 'saved' || captureStatus === 'done' ? (
                  <button className="btn-primary" onClick={handleStartCapture}>
                    キャプチャ開始
                  </button>
                ) : captureStatus === 'recording' ? (
                  <button className="btn-danger" onClick={handleStopCapture}>
                    キャプチャ停止
                  </button>
                ) : null}
              </div>

              {captureMessage && <div className="status-message">{captureMessage}</div>}
              {captureError && <div className="error-message">{captureError}</div>}

              {captureStatus === 'done' && (
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn-primary" onClick={handleSaveAndCopy}>
                    画像を結合して結果を取得
                  </button>
                </div>
              )}
            </section>

            {resultImage && (
              <section className="ocr-section">
                <h2>2. Geminiによる解析</h2>
                <img src={resultImage} alt="Stitched Result" className="result-image" />
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn-primary" onClick={handleAnalyzeImage} disabled={isAnalyzing}>
                    {isAnalyzing ? "解析中..." : "解析を実行"}
                  </button>
                  <button 
                    style={{ marginLeft: '1rem', background: '#555', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    onClick={() => setIsApiKeyModalOpen(true)}
                  >
                    APIキー設定
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="editor-section">
            <StatusEditor
              initialData={parsedData}
              onSave={handleEditorSave}
              onCancel={() => setParsedData(null)}
            />
          </section>
        )}
      </div>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
      />
    </div>
  );
}

export default App;
