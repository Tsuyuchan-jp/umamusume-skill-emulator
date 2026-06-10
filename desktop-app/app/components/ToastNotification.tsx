import { AlertCircle, Sparkles } from "lucide-react";

interface ToastNotificationProps {
  show: boolean;
  type: "success" | "error";
  message: string;
}

export function ToastNotification({ show, type, message }: ToastNotificationProps) {
  if (!show) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slideIn flex items-center gap-3 bg-zinc-900/75 border px-5 py-3 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-300 ${type === 'error' ? 'border-rose-500/30 text-rose-400' : 'border-emerald-500/30 text-emerald-400'}`}>
      {type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      <div className="flex flex-col">
        <span className={`text-[12px] font-bold font-sans tracking-wide ${type === 'error' ? 'text-rose-300' : 'text-zinc-200'}`}>
          {type === 'error' ? 'ERROR' : 'NOTIFICATION'}
        </span>
        <span className="text-[11px] text-zinc-400 font-sans font-medium">{message}</span>
      </div>
    </div>
  );
}
