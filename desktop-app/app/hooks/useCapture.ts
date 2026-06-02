import { useState, useEffect, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { stitchWithOpenCV } from "../lib/opencvStitcher";

export type CaptureStatus = "idle" | "recording" | "done" | "saving" | "saved";

export function useCapture() {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [frameCount, setFrameCount] = useState<number>(0);
  const [captureMessage, setCaptureMessage] = useState<string>("");
  const [saveResult, setSaveResult] = useState<string>("");
  const [captureError, setCaptureError] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");

  useEffect(() => {
    const unlistenPromise = listen<number>("capture-complete", (event) => {
      setFrameCount(event.payload);
      setCaptureStatus("done");
      setCaptureMessage(
        `${event.payload} フレームのキャプチャが完了しました。画像の結合と保存を自動で行います...`
      );
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleStartCapture = useCallback(async () => {
    setCaptureStatus("recording");
    setCaptureMessage("キャプチャを開始しました。ゲーム画面でスクロールしてください...");
    setCaptureError("");
    setSaveResult("");
    setResultImage("");
    setFrameCount(0);

    try {
      const result = await invoke<string>("start_capture_session");
      setCaptureMessage(result);
    } catch (error: unknown) {
      const msg = typeof error === "string" ? error : JSON.stringify(error);
      setCaptureStatus("idle");
      setCaptureError(`キャプチャエラー: ${msg}`);
    }
  }, []);

  const handleStopCapture = useCallback(async () => {
    try {
      await invoke<string>("stop_capture_session");
      setCaptureMessage("停止シグナルを送信しました...");
    } catch (error) {
      console.error("停止コマンドの呼び出しに失敗:", error);
    }
  }, []);

  const handleSaveAndCopy = useCallback(async () => {
    setCaptureStatus("saving");
    setSaveResult("");
    setCaptureError("");
    setResultImage("");

    try {
      const filePaths = await invoke<string[]>("save_and_copy_result");
      const cacheBuster = Date.now();
      const imageUrls = filePaths.map(path => `${convertFileSrc(path)}?t=${cacheBuster}`);

      setCaptureMessage("OpenCVで画像を結合しています...");
      const { cleanDataUrl } = await stitchWithOpenCV(imageUrls);

      const filename = `factor_${Date.now()}.png`;
      const saveFolder = localStorage.getItem("saveFolder");

      if (saveFolder) {
        // Rustバックエンド経由で指定フォルダに保存
        const savedPath = await invoke<string>("save_stitched_image", {
          base64Data: cleanDataUrl,
          directory: saveFolder,
          filename: filename
        });
        setSaveResult(`保存しました: ${savedPath}`);
      } else {
        // ブラウザ標準のダウンロード機能（フォールバック）
        const link = document.createElement("a");
        link.href = cleanDataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSaveResult(`ダウンロードフォルダに保存されました: ${filename}`);
      }

      setResultImage(cleanDataUrl);
      setCaptureStatus("saved");
      setCaptureMessage("画像の結合と保存が完了しました！");

    } catch (error: unknown) {
      const msg = typeof error === "string" ? error : (error instanceof Error ? error.message : JSON.stringify(error));
      setCaptureStatus("done");
      setCaptureError(`保存エラー: ${msg}`);
    }
  }, []);

  const handleResetCapture = useCallback(() => {
    setCaptureStatus("idle");
    setFrameCount(0);
    setCaptureMessage("");
    setSaveResult("");
    setCaptureError("");
    setResultImage("");
  }, []);

  const handleStartAutoCapture = useCallback(async () => {
    setCaptureStatus("recording");
    setCaptureMessage("自動スクロールキャプチャを開始しました。マウスを動かさないでください...");
    setCaptureError("");
    setSaveResult("");
    setResultImage("");
    setFrameCount(0);

    try {
      const result = await invoke<string>("start_auto_scroll_capture_session");
      setCaptureMessage(result);
    } catch (error: unknown) {
      const msg = typeof error === "string" ? error : JSON.stringify(error);
      setCaptureStatus("idle");
      setCaptureError(`自動キャプチャエラー: ${msg}`);
    }
  }, []);

  // キャプチャ完了時に自動で結合・保存処理を実行する
  useEffect(() => {
    if (captureStatus === "done") {
      handleSaveAndCopy();
    }
  }, [captureStatus, handleSaveAndCopy]);

  return {
    captureStatus,
    frameCount,
    captureMessage,
    saveResult,
    captureError,
    resultImage,
    handleStartCapture,
    handleStartAutoCapture,
    handleStopCapture,
    handleSaveAndCopy,
    handleResetCapture,
  };
}
