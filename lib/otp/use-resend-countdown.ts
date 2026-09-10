"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RESEND_COOLDOWN_SECONDS } from "./cooldown";

/**
 * Seconds left before "Resend code" is allowed again, counted down once a
 * second so the button can say how long the wait is instead of an open-ended
 * "shortly". Purely cosmetic: the real cooldown is enforced server-side in
 * requestOtp(), which this only tries to stay in step with.
 */
export function useResendCountdown(): {
  secondsLeft: number;
  ready: boolean;
  start: (seconds?: number) => void;
} {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadline = useRef<number>(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
  };

  const start = useCallback((seconds: number = RESEND_COOLDOWN_SECONDS) => {
    // Counts against a wall-clock deadline rather than decrementing a counter,
    // so a throttled or backgrounded tab resumes at the right number.
    deadline.current = Date.now() + seconds * 1000;
    setSecondsLeft(seconds);
    stop();
    interval.current = setInterval(() => {
      const left = Math.ceil((deadline.current - Date.now()) / 1000);
      setSecondsLeft(left > 0 ? left : 0);
      if (left <= 0) stop();
    }, 1000);
  }, []);

  useEffect(() => stop, []);

  return { secondsLeft, ready: secondsLeft <= 0, start };
}
