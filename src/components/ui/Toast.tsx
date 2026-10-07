"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ToastTone = "neutral" | "success" | "danger" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Adds an "Undo" action. Called at most once; the toast closes afterwards. */
  undo?: () => void;
  /** A custom single action (ignored if `undo` is set). */
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss. Default 6000 with undo/action, 4000 otherwise. 0 = sticky. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_VISIBLE = 3;

const toneIcon: Record<ToastTone, IconName | null> = {
  neutral: null,
  success: "check",
  danger: "alert",
  info: "info",
};
const toneColor: Record<ToastTone, string> = {
  neutral: "",
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notifications"
        aria-live="polite"
        className={cx(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4",
          "pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:p-6",
        )}
      >
        <ol className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const { id, title, description, tone = "neutral", undo, action } = toast;
  const hasAction = Boolean(undo || action);
  const duration = toast.duration ?? (hasAction ? 6000 : 4000);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(duration);
  const acted = useRef(false);

  useEffect(() => {
    if (duration === 0 || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [duration, paused, id, onDismiss]);

  const runAction = () => {
    if (acted.current) return;
    acted.current = true;
    if (undo) undo();
    else action?.onClick();
    onDismiss(id);
  };

  const icon = toneIcon[tone];

  return (
    <li
      className={cx(
        "k-enter-up pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-k-md border border-line",
        "bg-surface py-3 pl-4 pr-2 text-text shadow-k-2",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss(id);
      }}
    >
      {icon && <Icon name={icon} size={18} className={cx("mt-0.5", toneColor[tone])} />}
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-k-base font-medium leading-snug">{title}</p>
        {description && <p className="mt-0.5 text-k-sm text-text-2">{description}</p>}
      </div>
      {hasAction && (
        <button
          type="button"
          onClick={runAction}
          className={cx(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-k-sm px-2.5 text-k-sm font-semibold text-accent-ink",
            "transition-colors duration-(--k-dur-1) hover:bg-accent-wash",
          )}
        >
          {undo && <Icon name="undo" size={16} />}
          {undo ? "Undo" : action?.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-k-sm text-text-3 hover:bg-surface-2 hover:text-text"
      >
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}
