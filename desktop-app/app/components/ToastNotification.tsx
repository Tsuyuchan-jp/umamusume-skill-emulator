"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Sparkles } from "lucide-react";

interface ToastNotificationProps {
  show: boolean;
  type: "success" | "error";
  message: string;
}

/**
 * Tauri WebView2 では backdrop-filter が背後（特に SVG グラフ）をサンプルできない場合がある。
 * 透過は background の alpha 合成で表現する（blur は付けない）。
 */
export function ToastNotification({ show, type, message }: ToastNotificationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!show || !mounted) return null;

  const isError = type === "error";

  const toast = (
    <div className="fixed bottom-8 left-1/2 z-[9999] -translate-x-1/2 pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300
          border shadow-lg ring-1 ring-inset ring-white/10
          ${isError
            ? "border-rose-500/40 text-rose-400 shadow-rose-900/40"
            : "border-emerald-500/40 text-emerald-400 shadow-emerald-900/40"
          }`}
        style={{
          // Tailwind の /opacity より明示的な alpha（WebView2 で確実に合成されるよう inline 指定）
          backgroundColor: isError ? "rgba(24, 10, 14, 0.72)" : "rgba(10, 24, 18, 0.72)",
        }}
      >
        {isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Sparkles className="w-5 h-5 shrink-0" />}
        <div className="flex flex-col min-w-0 max-w-[min(90vw,28rem)]">
          <span className={`text-[12px] font-bold font-sans tracking-wide ${isError ? "text-rose-300" : "text-zinc-200"}`}>
            {isError ? "ERROR" : "NOTIFICATION"}
          </span>
          <span className="text-[11px] text-zinc-300/90 font-sans font-medium truncate">{message}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(toast, document.body);
}
