import type { HTMLAttributes } from "react";

function cx(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Base skeleton block. Uses `bg-muted` and `animate-pulse`, so it follows
 * `:root` and `.dark` tokens from `globals.css`—no separate light/dark components.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cx("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Single text line (default body line height). */
export function SkeletonLine({
  className,
  width = "w-full",
  ...props
}: SkeletonProps & { width?: string }) {
  return <Skeleton className={cx("h-4", width, className)} {...props} />;
}

/** Rounded block (image, stat, etc.). */
export function SkeletonBlock({
  className,
  ...props
}: SkeletonProps) {
  return <Skeleton className={cx("h-32 w-full", className)} {...props} />;
}

/** Circular placeholder (avatar, icon). */
export function SkeletonCircle({
  className,
  size = "h-10 w-10",
  ...props
}: SkeletonProps & { size?: string }) {
  return (
    <Skeleton className={cx("shrink-0 rounded-full", size, className)} {...props} />
  );
}

/** Several lines with the last one short—paragraph placeholder. */
export function SkeletonParagraph({
  lines = 3,
  className,
  ...props
}: SkeletonProps & { lines?: number }) {
  return (
    <div className={cx("space-y-2", className)} {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? "w-4/5" : "w-full"}
          className={i === lines - 1 ? "max-w-md" : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Card-shaped block with a title bar and body lines—matches dashboard cards.
 */
export function SkeletonCard({
  className,
  bodyLines = 3,
  ...props
}: SkeletonProps & { bodyLines?: number }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
      {...props}
    >
      <Skeleton className="mb-3 h-5 w-2/5 max-w-xs" />
      <SkeletonParagraph lines={bodyLines} />
    </div>
  );
}

/**
 * Table row: several cell blocks in a row (e.g. admin tables).
 */
export function SkeletonTableRow({
  cells = 4,
  className,
  ...props
}: SkeletonProps & { cells?: number }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 border-b border-border py-3",
        className,
      )}
      {...props}
    >
      {Array.from({ length: cells }, (_, i) => (
        <Skeleton
          key={i}
          className="h-4 min-w-16 flex-1 basis-0"
        />
      ))}
    </div>
  );
}

type PageSkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Number of paragraph-style cards below the hero. */
  cards?: number;
  showHero?: boolean;
};

/**
 * Typical dashboard page: page title, subtitle, optional hero block, then cards.
 * Wrap with your page padding if needed (`className="space-y-8"` on parent).
 */
export function PageSkeleton({
  cards = 2,
  className,
  showHero = true,
  ...props
}: PageSkeletonProps) {
  return (
    <div
      className={cx("space-y-8", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      {...props}
    >
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/5 max-w-sm" />
        <Skeleton className="h-4 w-3/5 max-w-md" />
      </div>
      {showHero && <SkeletonBlock className="h-40" />}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} bodyLines={i % 2 === 0 ? 3 : 4} />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-viewport shell: centered block for route `loading.tsx` or blocking states.
 */
export function FullPageSkeleton({
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cx(
        "flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading…</span>
      <SkeletonCircle size="h-14 w-14" />
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="mx-auto h-4 w-48" />
        <Skeleton className="mx-auto h-3 w-full max-w-xs" />
        <Skeleton className="mx-auto h-3 w-4/5 max-w-xs" />
      </div>
    </div>
  );
}
