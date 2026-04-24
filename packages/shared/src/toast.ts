type ToastType = "success" | "error" | "info";

type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastListener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
let listeners: ToastListener[] = [];

export const toast = {
  subscribe(listener: ToastListener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  show(type: ToastType, message: string) {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast = { id, type, message };
    toasts = [...toasts, newToast];
    this.notify();

    setTimeout(() => {
      this.dismiss(id);
    }, 5000);
  },

  success(message: string) {
    this.show("success", message);
  },

  error(message: string) {
    this.show("error", message);
  },

  info(message: string) {
    this.show("info", message);
  },

  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    this.notify();
  },

  notify() {
    listeners.forEach((l) => l(toasts));
  }
};
