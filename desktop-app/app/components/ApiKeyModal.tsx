import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  initialKey: string;
  onSave: (key: string) => Promise<void>;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, initialKey, onSave, onClose }: ApiKeyModalProps) {
  const [inputKey, setInputKey] = useState(initialKey);
  const [isSaving, setIsSaving] = useState(false);

  // initialKey が変わった場合（Credential Manager からロードされた後など）に同期する
  useEffect(() => {
    setInputKey(initialKey);
  }, [initialKey]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(inputKey);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <span className="text-indigo-400">🔑</span> Gemini APIキー設定
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          OCR機能を利用するには、Google AI Studioで取得したAPIキーを入力してください。<br/>
          APIキーはお使いの PC の Windows 資格情報マネージャーに保存されます。外部サーバーへ送信・同期されることはありません。
        </p>
        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
        />
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
