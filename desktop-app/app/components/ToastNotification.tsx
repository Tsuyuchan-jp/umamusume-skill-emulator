import { AlertCircle, Sparkles } from "lucide-react";

interface ToastNotificationProps {
  show: boolean;
  type: "success" | "error";
  message: string;
}

export function ToastNotification({ show, type, message }: ToastNotificationProps) {
  if (!show) return null;

  const isError = type === "error";

  return (
  <div
    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slideIn rounded-2xl p-px shadow-2xl transition-all duration-300
      ${isError
        ? "bg-gradient-to-b from-rose-400/50 via-rose-500/25 to-white/5 shadow-rose-500/30"
        : "bg-gradient-to-b from-emerald-400/50 via-emerald-500/25 to-white/5 shadow-emerald-500/30"
      }`}
  >
    <div
      className={`flex items-center gap-3 px-5 py-3 rounded-[15px]
        bg-black/15 backdrop-blur-2xl backdrop-saturate-150
        border border-white/15
        shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-1px_0_0_rgba(255,255,255,0.04)]
        ${isError ? "text-rose-400" : "text-emerald-400"}`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 shrink-0 drop-shadow-[0_0_8px_rgba(244,63,94,0.45)]" />
      ) : (
        <Sparkles className="w-5 h-5 shrink-0 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
      )}
      <div className="flex flex-col min-w-0 max-w-[min(90vw,28rem)]">
        <span className={`text-[12px] font-bold font-sans tracking-wide ${isError ? "text-rose-300" : "text-zinc-100"}`}>
          {isError ? "ERROR" : "NOTIFICATION"}
        </span>
        <span className="text-[11px] text-zinc-300/80 font-sans font-medium truncate">{message}</span>
      </div>
    </div>
  </div>
  );
}
