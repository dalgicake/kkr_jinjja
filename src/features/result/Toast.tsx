import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_MS = 2400;

/** `show(text)` puts a short message on screen for a moment (e.g. "Not connected yet"). */
export function useToast(): { message: string | null; show: (text: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (message === null) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, tick]);

  return { message, show };
}

/** Live region is always mounted so screen readers announce each new message. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
    >
      {message && (
        <p
          key={message}
          className="result-toast rounded-lg border-2 border-ink bg-ink px-4 py-3 text-[15px] font-bold text-receipt"
        >
          {message}
        </p>
      )}
    </div>
  );
}
