"use client";

import type { ReactNode, KeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

type ModalSize = "sm" | "md" | "lg" | "full";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
}

const sizeWidth: Record<ModalSize, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
  full: "max-w-[95vw] max-h-[95vh]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      }
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (previouslyFocused.current) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const hasHeader = Boolean(title || description);

  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="modal-shell" role="presentation">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          aria-describedby={description ? "modal-description" : undefined}
          onKeyDown={handlePanelKeyDown}
          className={`modal-panel ${sizeWidth[size]} flex flex-col`}
        >
          {hasHeader && (
            <div className="section-header">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 id="modal-title" className="section-title">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="modal-description" className="section-subtitle">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost btn-icon -mr-2 text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                <Icon name="x" size={18} strokeWidth={2} />
              </button>
            </div>
          )}

          <div className="px-5 py-4 overflow-y-auto flex-1 max-h-[70vh]">
            {children}
          </div>

          {footer && (
            <div className="flex gap-2 justify-end px-5 py-3 border-t border-slate-200 bg-slate-50/50">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Modal;
