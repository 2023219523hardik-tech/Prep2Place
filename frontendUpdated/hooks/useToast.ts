"use client";

import { useEffect, useState, useCallback } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

type Subscriber = (toasts: Toast[]) => void;

const subscribers: Set<Subscriber> = new Set();
let toastsState: Toast[] = [];
const timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

function notify(): void {
  subscribers.forEach((sub) => sub([...toastsState]));
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function dismissToast(id: string): void {
  const timeout = timeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    timeouts.delete(id);
  }
  toastsState = toastsState.filter((t) => t.id !== id);
  notify();
}

export function pushToast(toast: Omit<Toast, "id">): string {
  const id = generateId();
  const duration = toast.duration ?? 4200;
  const fullToast: Toast = { ...toast, id };

  toastsState = [...toastsState, fullToast];
  notify();

  if (duration > 0) {
    const timeout = setTimeout(() => {
      dismissToast(id);
    }, duration);
    timeouts.set(id, timeout);
  }

  return id;
}

function subscribe(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  subscriber([...toastsState]);
  return () => {
    subscribers.delete(subscriber);
  };
}

export interface UseToastReturn {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((currentToasts) => {
      setToasts(currentToasts);
    });
    return unsubscribe;
  }, []);

  const push = useCallback((toast: Omit<Toast, "id">): string => {
    return pushToast(toast);
  }, []);

  const dismiss = useCallback((id: string): void => {
    dismissToast(id);
  }, []);

  return { toasts, push, dismiss };
}

export default useToast;
