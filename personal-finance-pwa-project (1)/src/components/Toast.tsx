import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "success" | "warning" | "error" | "info";
type ToastItem = { id: string; message: string; tone: Tone };

type ToastValue = {
  push: (message: string, tone?: Tone) => void;
};

const ToastContext = React.createContext<ToastValue | null>(null);

const TONE_META: Record<Tone, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: "var(--success)" },
  warning: { icon: AlertCircle, color: "var(--amber)" },
  error: { icon: AlertCircle, color: "var(--danger)" },
  info: { icon: Info, color: "var(--sky)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const remove = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = React.useCallback(
    (message: string, tone: Tone = "success") => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast_${Math.random()}`;
      setItems((current) => [...current.slice(-2), { id, message, tone }]);
      const timer = setTimeout(() => remove(id), 3400);
      timers.current.push(timer);
    },
    [remove]
  );

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[80] mx-auto flex w-full max-w-[430px] flex-col gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
        >
          {items.map((item) => {
            const meta = TONE_META[item.tone];
            const Icon = meta.icon;
            return (
              <div
                key={item.id}
                className="toast-enter pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <Icon size={18} style={{ color: meta.color }} className="shrink-0" />
                <span className="flex-1 text-[12.5px] font-semibold leading-snug">{item.message}</span>
                <button
                  aria-label="Fechar aviso"
                  onClick={() => remove(item.id)}
                  className="rounded-md p-1 text-[var(--faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de ToastProvider");
  return context;
}
