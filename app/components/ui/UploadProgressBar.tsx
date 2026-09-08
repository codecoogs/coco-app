"use client";

import { useEffect, useState } from "react";

/**
 * supabase-js's storage upload has no byte-level progress callback, so this
 * eases toward 90% for as long as `active` is true, then snaps to 100% and
 * fades out once the caller flips it back to false - standard "something is
 * happening and about to finish" treatment for an operation with no real
 * progress signal.
 */
export function UploadProgressBar({ active }: { active: boolean }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!active) {
      if (pct === 0) return;
      setPct(100);
      const t = setTimeout(() => setPct(0), 400);
      return () => clearTimeout(t);
    }

    setPct((p) => (p > 0 ? p : 8));
    const interval = setInterval(() => {
      setPct((p) => (p >= 90 ? p : p + (90 - p) * 0.15));
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pct is read via the updater form, not needed as a dep
  }, [active]);

  if (pct === 0) return null;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-200 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
