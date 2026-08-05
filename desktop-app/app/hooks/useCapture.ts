import { useState, useEffect, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { deriveCaptureWheelFromFrameUrl } from "../lib/stitch/captureWheel";
import type { CaptureWheelDecision } from "../lib/stitch/wheelCore";
import { stitchImages } from "../lib/stitch";
import { filePathToDataUrl } from "../lib/fileImageToDataUrl";

export type CaptureStatus = "idle" | "recording" | "done" | "saving" | "saved";

/** 自動キャプチャのホイール推定（R3.5d・Rust capture-wheel-decision / capture-complete） */
export type CaptureWheelInfo = {
  wheel: number;
  scrollRegionH: number | null;
  reason: string;
};

type CaptureCompletePayload = {
  frameCount: number;
  frameDir: string;
  wheel?: number;
  scrollRegionH?: number | null;
  reason?: string;
};

function formatCaptureWheelLog(info: CaptureWheelInfo): string {
  const region =
    info.scrollRegionH != null && info.scrollRegionH > 0
      ? `${info.scrollRegionH}px`
      : "?px";
  return `[Capture] scrollRegion=${region} wheel=${info.wheel} reason=${info.reason}`;
}

function logCaptureWheel(info: CaptureWheelInfo, label: string): void {
  console.log(`${formatCaptureWheelLog(info)} (${label})`);
}

export function useCapture() {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [frameCount, setFrameCount] = useState<number>(0);
  const [debugFramePaths, setDebugFramePaths] = useState<string[]>([]);
  const [captureMessage, setCaptureMessage] = useState<string>("");
  const [saveResult, setSaveResult] = useState<string>("");
  const [captureError, setCaptureError] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");
  /** ファイル選択由来のプレビュー。true のとき autoCopy / saveFolder 再保存をスキップ */
  const [resultImageFromFile, setResultImageFromFile] = useState(false);

  useEffect(() => {
    const unlistenWheel = listen<CaptureWheelInfo>("capture-wheel-decision", (event) => {
      logCaptureWheel(event.payload, "frame0 推定");
    });

    const unlistenComplete = listen<CaptureCompletePayload>("capture-complete", (event) => {
      const { frameCount: count, frameDir, wheel, scrollRegionH, reason } = event.payload;
      if (wheel != null && reason != null) {
        logCaptureWheel(
          { wheel, scrollRegionH: scrollRegionH ?? null, reason },
          "セッション完了"
        );
      }
      setFrameCount(count);
      setCaptureStatus("done");
      setCaptureMessage(
        `${count} フレームのキャプチャが完了しました。画像の結合と保存を自動で行います...`
      );
      // デバッグ用: フレームファイルのパスを生成
      const paths: string[] = [];
      for (let i = 0; i < count; i++) {
        const framePath = `${frameDir}\\frame_${String(i).padStart(3, '0')}.png`;
        paths.push(`${convertFileSrc(framePath)}?t=${Date.now()}`);
      }
      setDebugFramePaths(paths);
    });

    return () => {
      unlistenWheel.then((unlisten) => unlisten());
      unlistenComplete.then((unlisten) => unlisten());
    };
  }, []);

  const handleStartCapture = useCallback(async () => {
    setCaptureStatus("recording");
    setCaptureMessage("キャプチャを開始しました。ゲーム画面でスクロールしてください...");
    setCaptureError("");
    setSaveResult("");
    setResultImage("");
    setResultImageFromFile(false);
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
    setResultImageFromFile(false);

    try {
      const filePaths = await invoke<string[]>("save_and_copy_result");
      const cacheBuster = Date.now();
      const imageUrls = filePaths.map(path => `${convertFileSrc(path)}?t=${cacheBuster}`);

      setCaptureMessage("画像を結合しています...");
      const { cleanDataUrl } = await stitchImages(imageUrls);

      const skipDiskSave = localStorage.getItem("skipStitchedDiskSave") === "true";

      if (!skipDiskSave) {
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
        setCaptureMessage("画像の結合と保存が完了しました！");
      } else {
        setSaveResult("");
        setCaptureMessage("画像の結合が完了しました（ディスクには保存していません）");
      }

      setResultImage(cleanDataUrl);
      setResultImageFromFile(false);
      setCaptureStatus("saved");

    } catch (error: unknown) {
      const msg = typeof error === "string" ? error : (error instanceof Error ? error.message : JSON.stringify(error));
      setCaptureStatus("idle"); // "done"に戻すとuseEffectが再発火して無限ループになるため "idle" に変更
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
    setResultImageFromFile(false);
    setDebugFramePaths([]); // ← 追加
  }, []);

  /**
   * 過去の結合済み画像を選び、プレビュー用に resultImage へ載せる（自動 OCR・再保存なし）。
   */
  const handleLoadImageFromFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "画像", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (!selected || typeof selected !== "string") {
        return;
      }

      const dataUrl = await filePathToDataUrl(selected);
      setResultImageFromFile(true);
      setResultImage(dataUrl);
      setCaptureStatus("saved");
      setCaptureMessage(
        "画像ファイルを読み込みました。プレビューを確認し、「画像からステータスを読込」を押してください。"
      );
      setCaptureError("");
      setSaveResult("");
      setDebugFramePaths([]);
    } catch (error: unknown) {
      const msg =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : JSON.stringify(error);
      setCaptureError(`画像ファイルの読み込みに失敗しました: ${msg}`);
    }
  }, []);

  const handleStartAutoCapture = useCallback(async () => {
    setCaptureStatus("recording");
    setCaptureMessage("自動スクロールキャプチャを開始しました。マウスを動かさないでください...");
    setCaptureError("");
    setSaveResult("");
    setResultImage("");
    setResultImageFromFile(false);
    setFrameCount(0);

    try {
      // M5: frame0 プレビュー → stitch 正本で wheel 決定 → Rust へ IPC
      const framePath = await invoke<string>("capture_frame0_preview");
      const frameUrl = `${convertFileSrc(framePath)}?t=${Date.now()}`;
      const wheelDecision: CaptureWheelDecision =
        await deriveCaptureWheelFromFrameUrl(frameUrl);
      logCaptureWheel(wheelDecision, "stitch frame0");

      await invoke<string>("start_auto_scroll_capture_session", {
        wheel: wheelDecision.wheel,
        scrollRegionH: wheelDecision.scrollRegionH ?? 0,
        reason: wheelDecision.reason,
      });
      setCaptureMessage("自動スクロールを実行中...");
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
    resultImageFromFile,
    debugFramePaths, // ← 追加
    handleStartCapture,
    handleStartAutoCapture,
    handleStopCapture,
    handleSaveAndCopy,
    handleResetCapture,
    handleLoadImageFromFile,
  };
}
