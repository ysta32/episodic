"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { lockScroll } from "./scrollLock";
import { IconButton } from "./IconButton";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it remains the accessible name). */
  hideTitle?: boolean;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  dismissible?: boolean;
}

/** Shared native <dialog> behaviour: modal focus containment, Esc, backdrop click, scroll lock, focus restore. */
export function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const onCancel = (e: Event) => {
        e.preventDefault();
        onCloseRef.current();
      };
      el.addEventListener("cancel", onCancel);
      el.showModal();
      const unlock = lockScroll();
      return () => {
        el.removeEventListener("cancel", onCancel);
        unlock();
        if (el.open) el.close();
        if (previous && previous.isConnected) previous.focus();
      };
    }
  }, [open]);

  return ref;
}

function Header({ title, titleId, description, descId, hideTitle, onClose }: {
  title: string;
  titleId: string;
  description?: string;
  descId: string;
  hideTitle?: boolean;
  onClose: () => void;
}) {
  return (
    <header className="flex items-start gap-3 px-5 pt-5 sm:px-6">
      <div className={cx("min-w-0 flex-1", hideTitle && "sr-only")}>
        <h2 id={titleId} className="font-display text-k-xl font-medium tracking-[-0.01em] text-text">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1 text-k-sm text-text-2">
            {description}
          </p>
        )}
      </div>
      <IconButton icon="close" label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1 ml-auto" />
    </header>
  );
}

function Panel({
  variant,
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: BaseProps & { variant: "dialog" | "sheet" }) {
  const ref = useNativeDialog(open, onClose);
  const titleId = useId();
  const descId = useId();
  if (!open) return null;
  const sheet = variant === "sheet";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "k-dialog border border-line bg-surface p-0 text-text shadow-k-3 backdrop:bg-transparent",
        sheet
          ? cx(
              "k-sheet-bottom m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-k-lg",
              "md:ml-auto md:mt-0 md:h-dvh md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-k-lg",
            )
          : "m-auto w-[calc(100%-2rem)] max-w-[520px] rounded-k-lg",
        className,
      )}
    >
      <div className={cx("flex max-h-[inherit] flex-col", sheet && "md:h-full")}>
        {sheet && <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-k-pill bg-line-strong md:hidden" />}
        <Header
          title={title}
          titleId={titleId}
          description={description}
          descId={descId}
          hideTitle={hideTitle}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

export type DialogProps = BaseProps;

/** Centered modal for confirmations and short forms. */
export function Dialog(props: DialogProps) {
  return <Panel variant="dialog" {...props} />;
}

/** Bottom sheet on mobile, right-side sheet from md up. For details, filters, threads. */
export function Sheet(props: DialogProps) {
  return <Panel variant="sheet" {...props} />;
}
