import React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "../utils/cn";
import { centsToInput, parseMoneyToCents } from "../lib/money";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className)}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...props} aria-label={label} title={label} className={cn("icon-btn", className)}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[11px] font-semibold text-[var(--danger)]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11px] leading-snug text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cn("input", className)} />;
});

export function MoneyInput({
  valueCents,
  onChangeCents,
  className,
  tone = "neutral",
  ariaLabel = "Valor em reais",
}: {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
  tone?: "neutral" | "large" | "coral";
  ariaLabel?: string;
}) {
  const [focused, setFocused] = React.useState(false);
  const [raw, setRaw] = React.useState(() => centsToInput(valueCents));

  React.useEffect(() => {
    if (!focused) setRaw(centsToInput(valueCents));
  }, [valueCents, focused]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-[var(--surface-2)] px-3 transition focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)] focus-within:shadow-[0_0_0_3px_var(--ring)]",
        tone === "large" ? "min-h-[58px]" : "min-h-[44px]",
        className
      )}
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className={cn(
          "num shrink-0 font-semibold",
          tone === "large" ? "text-base" : "text-xs",
          tone === "coral" ? "text-[var(--coral)]" : "text-[var(--muted)]"
        )}
      >
        R$
      </span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={raw}
        onFocus={() => {
          setFocused(true);
          setRaw(centsToInput(valueCents));
        }}
        onBlur={() => {
          setFocused(false);
          setRaw(centsToInput(valueCents));
        }}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          onChangeCents(parseMoneyToCents(next));
        }}
        placeholder="0,00"
        className={cn(
          "num w-full min-w-0 border-0 bg-transparent py-2 font-semibold text-[var(--text)] outline-none placeholder:text-[var(--faint)]",
          tone === "large" ? "text-[24px]" : "text-[15px]"
        )}
        style={tone === "coral" ? { color: "var(--coral)" } : undefined}
      />
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn("input appearance-none pr-9", className)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("segmented", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "accent",
  className,
  height,
}: {
  value: number;
  tone?: "accent" | "coral" | "amber" | "sky" | "muted";
  className?: string;
  height?: number;
}) {
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    coral: "var(--coral)",
    amber: "var(--amber)",
    sky: "var(--sky)",
    muted: "var(--muted)",
  };
  return (
    <div className={cn("progress", className)} style={height ? { height } : undefined}>
      <span
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: colors[tone],
        }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "coral" | "amber" | "sky";
  dot?: boolean;
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    neutral: "",
    accent: "chip-accent",
    coral: "chip-coral",
    amber: "",
    sky: "",
  };
  const styles: Record<string, React.CSSProperties> = {
    neutral: {},
    accent: {},
    coral: {},
    amber: {
      background: "rgba(247, 200, 115, 0.1)",
      borderColor: "rgba(247, 200, 115, 0.22)",
      color: "var(--amber)",
    },
    sky: {
      background: "rgba(125, 211, 252, 0.09)",
      borderColor: "rgba(125, 211, 252, 0.2)",
      color: "var(--sky)",
    },
  };
  return (
    <span className={cn("chip", toneClass[tone], className)} style={styles[tone]}>
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "currentColor" }}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const root = dialogRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
      );
      (target ?? root).focus({ preventScroll: true });
    };
    const raf = window.requestAnimationFrame(focusFirst);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
        )
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[760px]" };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          "modal-card modal-enter relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[26px] sm:max-h-[90dvh] sm:rounded-[26px]",
          widths[size]
        )}
      >
        <div className="flex items-start gap-3 border-b px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: "var(--border)" }}>
          {icon ? (
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--accent)",
              }}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="font-display text-[17px] font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div
            className="flex items-center justify-end gap-2 border-t px-5 py-4 sm:px-6"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-[var(--text-soft)]">{message}</p>
    </Modal>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}>
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}
      >
        {icon}
      </div>
      <p className="font-display text-[14px] font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 max-w-[290px] text-[12px] leading-relaxed text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] border"
        style={{
          borderColor: "var(--hero-border)",
          background: "linear-gradient(140deg, #1b2b1e 0%, #0c140f 100%)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M6 14 16 6l10 8" stroke="#ccf56e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".85" />
          <path d="M9 25V14l7-5.3L23 14v11" stroke="#ccf56e" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="16" cy="20" r="2.2" fill="#ccf56e" />
        </svg>
      </div>
      {!compact ? (
        <div className="leading-none">
          <span className="font-display text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">
            ninho<span style={{ color: "var(--accent)" }}>.</span>
          </span>
          <p className="mt-1 max-w-[170px] whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">
            finanças na palma da mão
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-semibold"
      style={{
        width: size,
        height: size,
        borderColor: "var(--border-strong)",
        background: "var(--surface-2)",
        color: "var(--accent)",
      }}
      aria-hidden
    >
      {initials || "N"}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div>
        <h2 className="font-display text-[14px] font-semibold tracking-[-0.015em] text-[var(--text)]">{title}</h2>
        {description ? <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
