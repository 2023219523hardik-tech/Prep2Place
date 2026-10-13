"use client";

import { useEffect } from "react";
import { redirectToLogin } from "@/lib/api";

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const isAuth =
    message.toLowerCase().includes("authentication") ||
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("session") ||
    message.toLowerCase().includes("access denied") ||
    message.toLowerCase().includes("forbidden");

  useEffect(() => {
    if (isAuth) {
      const timer = setTimeout(() => {
        redirectToLogin(typeof window !== "undefined" ? window.location.pathname : undefined);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isAuth]);

  if (isAuth) {
    return (
      <div className="surface-card p-8 text-center max-w-lg mx-auto my-12 border border-slate-200 shadow-sm rounded-2xl animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h3 className="font-display text-base font-semibold text-slate-900">Session Expired</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          Your session has expired or requires re-authentication. Redirecting you to login...
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => redirectToLogin(typeof window !== "undefined" ? window.location.pathname : undefined)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            Sign In Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-red-50 border-red-200 text-red-700 text-sm flex items-center justify-between p-4 rounded-xl">
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-red-500">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline hover:no-underline font-semibold text-xs text-red-800">
          Retry
        </button>
      )}
    </div>
  );
}

