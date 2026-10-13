"use client";

import type { ReactNode } from "react";

interface FieldGroupProps {
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function FieldGroup({
  title,
  eyebrow,
  description,
  children,
  action,
  className = "",
}: FieldGroupProps) {
  const hasHeader = Boolean(title || description || action || eyebrow);

  return (
    <div className={`field-group ${className}`}>
      {hasHeader && (
        <>
          <header className="flex items-start justify-between mb-2 gap-4">
            <div className="flex-1 min-w-0">
              {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
              {title && <div className="section-title">{title}</div>}
              {description && (
                <div className="text-sm muted mt-0.5">{description}</div>
              )}
            </div>
            {action && (
              <div className="flex-shrink-0 pt-0.5">{action}</div>
            )}
          </header>
          <div className="divider" />
        </>
      )}
      <div>{children}</div>
    </div>
  );
}

export default FieldGroup;
