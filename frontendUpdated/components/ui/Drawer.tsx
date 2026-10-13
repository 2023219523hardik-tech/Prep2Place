"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

type DrawerSide = "right";
type DrawerSize = "md" | "lg";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  side?: DrawerSide;
  footer?: ReactNode;
  size?: DrawerSize;
}

const sizeWidth: Record<DrawerSize, string> = {
  md: "max-w-[384px]",
  lg: "max-w-[512px]",
};

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  side = "right",
  footer,
  size = "md",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (previouslyFocused.current) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const hasHeader = Boolean(title || subtitle);

  return (
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      {side === "right" && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "drawer-title" : undefined}
          className={`drawer-panel-right ${sizeWidth[size]} flex flex-col`}
        >
          {hasHeader && (
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id="drawer-title"
                    className="font-display text-lg font-semibold text-slate-900 tracking-tight"
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 btn-ghost btn-icon -mr-2 -mt-1 text-slate-400 hover:text-slate-600"
                aria-label="Close drawer"
              >
                <Icon name="x" size={18} strokeWidth={2} />
              </button>
            </div>
          )}

          <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>

          {footer && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default Drawer;
