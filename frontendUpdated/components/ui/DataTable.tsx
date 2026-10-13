"use client";

import type { ReactNode } from "react";
import type { IconName } from "./Icon";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

interface DataTableColumn<T> {
  key: string;
  label: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  stickyHeader?: boolean;
  rowKey: keyof T | ((row: T) => string);
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyDesc: string;
  emptyIcon: IconName;
  loading?: boolean;
  renderSkeletonRow?: (index: number) => ReactNode;
  className?: string;
}

const alignClass: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function getRowKey<T>(
  rowKey: DataTableProps<T>["rowKey"],
  row: T,
  index: number
): string {
  if (typeof rowKey === "function") {
    return rowKey(row);
  }
  const val = row[rowKey];
  if (val === null || val === undefined) {
    return String(index);
  }
  return String(val);
}

export function DataTable<T>({
  columns,
  data,
  stickyHeader = false,
  rowKey,
  onRowClick,
  emptyTitle,
  emptyDesc,
  emptyIcon,
  loading = false,
  renderSkeletonRow,
  className = "",
}: DataTableProps<T>) {
  const tableClasses = `data-table ${stickyHeader ? "data-table-sticky" : ""}`;
  const colCount = columns.length;

  return (
    <section className={`section-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className={tableClasses}>
          <thead>
            <tr>
              {columns.map((col) => {
                const align = alignClass[col.align ?? "left"];
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={align}
                  >
                    {loading ? (
                      <Skeleton variant="line" className="w-3/4 h-3" />
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) =>
                renderSkeletonRow ? (
                  renderSkeletonRow(i)
                ) : (
                  <tr key={i}>
                    {columns.map((col, ci) => (
                      <td key={col.key} className={alignClass[col.align ?? "left"]}>
                        <Skeleton
                          variant="line"
                          className={ci === 0 ? "w-5/6" : "w-4/5"}
                        />
                      </td>
                    ))}
                  </tr>
                )
              )
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDesc}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = getRowKey(rowKey, row, index);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={onRowClick ? { cursor: "pointer" } : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={alignClass[col.align ?? "left"]}
                        style={col.width ? { width: col.width } : undefined}
                      >
                        {col.render
                          ? col.render(row, index)
                          : (row as Record<string, ReactNode>)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DataTable;
