"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

/**
 * Minimal fixed toast (no extra dependency).
 */
export function SimpleToast({
  message,
  onDismiss,
  durationMs = 2200,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[100] max-w-sm -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm text-foreground shadow-md transition-opacity duration-200"
      role="status"
    >
      {message}
    </div>
  );
}
