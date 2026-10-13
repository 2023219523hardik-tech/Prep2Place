"use client";

import type { ReactNode } from "react";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

type EmptyStateVariant = "neutral" | "info" | "success" | "warning" | "danger";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
  variant?: EmptyStateVariant;
}

const variantTint: Record<EmptyStateVariant, string> = {
  neutral: "text-slate-500",
  info: "text-premium-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "neutral",
}: EmptyStateProps) {
  return (
    <div className="surface-card p-8 text-center">
      <div
        className={`w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mx-auto ${variantTint[variant]}`}
      >
        <Icon name={icon} size={28} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-base font-semibold mt-4 text-slate-900">
        {title}
      </h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export default EmptyState;
