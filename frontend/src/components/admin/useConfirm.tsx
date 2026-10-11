"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Use for destructive actions (delete). */
  danger?: boolean;
};

/**
 * Promise-based confirmation dialog for admin actions.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Save changes?" }))) return;
 *   ...render {dialog} once in the component tree.
 */
export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, settle]);

  const dialog = opts ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => settle(false)}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/15 bg-bg-elevated p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-title" className="font-display text-lg text-white">
          {opts.title}
        </p>
        {opts.message ? <p className="mt-2 text-sm text-muted">{opts.message}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-muted hover:text-white"
            onClick={() => settle(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            className={
              opts.danger
                ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-bg"
            }
            onClick={() => settle(true)}
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
