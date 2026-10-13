"use client";

import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { useToast, type ToastVariant } from "@/hooks/useToast";

const variantIcon: Record<ToastVariant, IconName> = {
  success: "check-circle",
  error: "alert-circle",
  warning: "alert-triangle",
  info: "info",
};

const variantIconClass: Record<ToastVariant, string> = {
  success: "text-emerald-600",
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-premium-600",
};

export function ToastPortal() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.variant}`}
          role="status"
        >
          <div
            className={`flex-shrink-0 mt-0.5 ${variantIconClass[toast.variant]}`}
          >
            <Icon name={variantIcon[toast.variant]} size={20} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="toast-title">{toast.title}</div>
            {toast.description && (
              <div className="toast-desc">{toast.description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="flex-shrink-0 btn-ghost btn-icon -mr-2 -mt-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={16} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

export const GlobalToastPortal = ToastPortal;

export default ToastPortal;
