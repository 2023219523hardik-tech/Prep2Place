"use client";

import { forwardRef, type HTMLAttributes, type ReactElement } from "react";

type SkeletonVariant = "line" | "circle";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { variant, className = "", style, ...rest },
  ref
) {
  const variantClasses =
    variant === "circle"
      ? "skeleton-circle aspect-square w-10 h-10"
      : variant === "line"
      ? "skeleton-line"
      : "h-4";

  return (
    <div
      ref={ref}
      className={`skeleton ${variantClasses} ${className}`}
      style={style}
      {...rest}
    />
  );
});

type SkeletonGroupVariant = "card" | "kpi" | "table" | "list";

interface SkeletonGroupProps {
  variant: SkeletonGroupVariant;
  className?: string;
}

function SkeletonGroupCard(): ReactElement {
  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="circle" className="w-12 h-12 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton variant="line" className="w-2/3" />
          <Skeleton variant="line" className="w-1/2" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton variant="line" />
        <Skeleton variant="line" />
        <Skeleton variant="line" className="w-5/6" />
      </div>
    </div>
  );
}

function SkeletonGroupKpi(): ReactElement {
  return (
    <div className="kpi-tile space-y-2">
      <Skeleton variant="line" className="w-24 h-3" />
      <Skeleton variant="line" className="w-10/12 h-7 rounded-lg" />
      <Skeleton variant="line" className="w-16 h-3" />
    </div>
  );
}

function SkeletonGroupTable(): ReactElement {
  const rows = Array.from({ length: 5 });
  const cols = Array.from({ length: 4 });
  return (
    <div className="section-card overflow-hidden">
      <div className="bg-slate-50/60 border-b border-slate-200 px-4 py-3 grid grid-cols-4 gap-4">
        {cols.map((_, i) => (
          <Skeleton key={i} variant="line" className="w-3/4 h-3" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((_, ri) => (
          <div key={ri} className="px-4 py-3 grid grid-cols-4 gap-4">
            {cols.map((_, ci) => (
              <Skeleton
                key={ci}
                variant="line"
                className={ci === 0 ? "w-5/6" : "w-4/5"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonGroupList(): ReactElement {
  const rows = Array.from({ length: 6 });
  return (
    <div className="surface-card divide-y divide-slate-100">
      {rows.map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <Skeleton variant="circle" className="w-9 h-9 flex-shrink-0" />
          <Skeleton variant="line" className="flex-1" />
        </div>
      ))}
    </div>
  );
}

function SkeletonGroup({ variant, className = "" }: SkeletonGroupProps) {
  const wrapperClass = className;
  switch (variant) {
    case "card":
      return <div className={wrapperClass}>{SkeletonGroupCard()}</div>;
    case "kpi":
      return <div className={wrapperClass}>{SkeletonGroupKpi()}</div>;
    case "table":
      return <div className={wrapperClass}>{SkeletonGroupTable()}</div>;
    case "list":
      return <div className={wrapperClass}>{SkeletonGroupList()}</div>;
    default:
      return null;
  }
}

function Shimmer(): null {
  return null;
}

export { Skeleton, SkeletonGroup, Shimmer };
export default Skeleton;
