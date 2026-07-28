function cx(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

type SpinnerProps = {
  className?: string;
  /** Tailwind size classes, e.g. "h-4 w-4". */
  size?: string;
};

/** Inline loading spinner. Uses currentColor, so it inherits the parent's text color. */
export function Spinner({ className, size = "h-4 w-4" }: SpinnerProps) {
  return (
    <svg
      className={cx("animate-spin", size, className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
