import { useState, useRef } from "react";

export function useToast() {
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToastMessage = (msg: string, type: "success" | "error" = "success", durationMs: number = 3000) => {
    setToastType(type);
    setToastMessage(msg);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (durationMs > 0) {
      toastTimeoutRef.current = setTimeout(() => setShowToast(false), durationMs);
    }
  };

  return {
    showToast,
    toastMessage,
    toastType,
    showToastMessage,
  };
}
