import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

function cx(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Central button styling for the app. Press/pop feedback and the pointer
 * cursor come for free from the global rules in globals.css (apply to any
 * `<button>`, not just this component). This component adds the shared
 * variant/size look plus a built-in loading spinner.
 *
 * `loading` disables the button, sets `aria-busy`, and shows a spinner before
 * the children — pass whatever label you want shown while busy, e.g.
 * `<Button loading={busy}>{busy ? "Saving…" : "Save"}</Button>`.
 */

const VARIANT_CLASSES = {
  /** The look used by the vast majority of buttons in the app. */
  default:
    "border border-border bg-card text-card-foreground hover:bg-muted disabled:opacity-50",
  /** Destructive actions (delete, remove, archive). Matches existing red-text link style. */
  danger:
    "text-red-600 hover:underline disabled:opacity-50 dark:text-red-400",
  /** No border/background — icon buttons, toolbar actions. */
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
} as const;

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

type ButtonVariant = keyof typeof VARIANT_CLASSES;
type ButtonSize = keyof typeof SIZE_CLASSES;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "default",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner size={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}
