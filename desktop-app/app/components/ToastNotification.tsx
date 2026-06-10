import { AlertCircle, Sparkles } from "lucide-react";

interface ToastNotificationProps {
  show: boolean;
  type: "success" | "error";
  message: string;
}

export function ToastNotification({ show, type, message }: ToastNotificationProps) {
  if (!show) return null;

  const isError = type === "error";

  // 位置用 transform は外側のみ。内側に backdrop-filter を置く（同一要素だと Chromium で blur が無効化される）
  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300
          bg-black/25 backdrop-blur-xl backdrop-saturate-150
          border shadow-2xl ring-1 ring-inset ring-white/10
          ${isError
            ? "border-rose-500/30 text-rose-400 shadow-rose-500/20"
            : "border-emerald-500/30 text-emerald-400 shadow-emerald-500/20"
          }`}
      >
        {isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Sparkles className="w-5 h-5 shrink-0" />}
        <div className="flex flex-col min-w-0 max-w-[min(90vw,28rem)]">
          <span className={`text-[12px] font-bold font-sans tracking-wide ${isError ? "text-rose-300" : "text-zinc-200"}`}>
            {isError ? "ERROR" : "NOTIFICATION"}
          </span>
          <span className="text-[11px] text-zinc-400/90 font-sans font-medium truncate">{message}</span>
        </div>
      </div>
    </div>
  );
}
