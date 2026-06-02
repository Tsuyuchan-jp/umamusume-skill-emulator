"use client";

import { useEffect, useState, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export default function OverlayPage() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // マウスクリック貫通の設定
  useEffect(() => {
    const setupWindow = async () => {
      try {
        const win = getCurrentWindow();
        await win.setIgnoreCursorEvents(true);
      } catch (err) {
        console.error("Failed to set ignore cursor events", err);
      }
    };
    setupWindow();
  }, []);

  // イベントリスナーの登録
  useEffect(() => {
    const unlistenPromise = listen("overlay-status", (event: any) => {
        const { status: newStatus, message: msg } = event.payload;

        if (newStatus === "idle") {
          setShow(false);
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          setTimeout(async () => {
            try { await invoke("hide_overlay"); } catch (e) {}
          }, 300);
          return;
        }

        let displayMsg = msg;
        if (newStatus === "recording") displayMsg = "キャプチャ中...";
        else if (newStatus === "done" || newStatus === "saving") displayMsg = "画像結合中...";
        else if (newStatus === "saved") displayMsg = "保存・コピー完了！";

        const isError = msg && msg.includes("エラー");
        if (isError) {
          setStatus("error");
          setMessage(msg);
        } else {
          setStatus(newStatus);
          setMessage(displayMsg);
        }
        
        setShow(true);

        // 既存のタイマーをクリア
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

        // 完了またはエラーの場合は自動的に消す
        if (newStatus === "saved" || isError) {
          hideTimeoutRef.current = setTimeout(() => {
            setShow(false);
            // アニメーション完了後にウィンドウ自体を非表示にする
            setTimeout(async () => {
              try { await invoke("hide_overlay"); } catch (e) {}
            }, 300);
          }, 3000);
        }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // ステータスに応じたスタイルとアイコンを決定
  let borderColor = "border-l-4 border-transparent";
  let icon = "";
  let iconClass = "";

  if (status === "recording") {
    borderColor = "border-l-4 border-rose-500";
    icon = "📸";
    iconClass = "animate-pulse";
  } else if (status === "done" || status === "saving") {
    borderColor = "border-l-4 border-violet-400";
    icon = "🔄";
    iconClass = "animate-spin";
  } else if (status === "saved") {
    borderColor = "border-l-4 border-emerald-400";
    icon = "✅";
  } else if (status === "error") {
    borderColor = "border-l-4 border-red-500";
    icon = "❌";
  }

  return (
    <div className="w-full h-screen flex items-center justify-start p-6">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 bg-sky-100/25 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-sky-200/50 text-slate-800 font-bold text-sm tracking-wide transition-all duration-300 ease-out ${
          show ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-5"
        } ${borderColor}`}
        style={{
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 0 0 1px rgba(224, 242, 254, 0.4)"
        }}
      >
        <span className={`text-base ${iconClass}`}>{icon}</span>
        <span className="drop-shadow-sm">{message}</span>
      </div>
    </div>
  );
}
