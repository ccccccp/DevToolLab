"use client";

import { useEffect, useState } from "react";
import { toast } from "@devtoollab/shared";

type ToastMessage = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div className="toast-content">{t.message}</div>
          <button
            type="button"
            className="toast-close"
            onClick={() => toast.dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
