"use client";

import { PasswordInput } from "@/app/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import {
  sanitizeExpectedGraduationInput,
  validateEmail,
  validateExpectedGraduation,
  validatePassword,
  validatePersonName,
} from "@/lib/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const SIGNUP_MAJOR_OPTIONS = [
  "Computer Science",
  "Computer Engineering",
  "MIS",
  "CIS",
  "Other",
] as const;

type SignUpModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
  /** Post-sign-in redirect when email confirmation is off (immediate session). */
  next?: string;
  /** True when opened via invite link (?from=invite); user already has an auth session. */
  fromInvite?: boolean;
};

export function SignUpModal({
  open,
  onClose,
  onOpenSignIn,
  next = "/dashboard",
  fromInvite = false,
}: SignUpModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [expectedGraduation, setExpectedGraduation] = useState("");
  const [major, setMajor] = useState<string>(SIGNUP_MAJOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const client = createClient();
    void client.auth.getUser().then(({ data: { user } }) => {
      setSessionUserId(user?.id ?? null);
      if (fromInvite && user?.email) {
        setEmail(user.email);
      }
    });
  }, [open, fromInvite]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const fn = validatePersonName(firstName, "First name");
    if (!fn.valid) {
      setMessage({ type: "error", text: fn.error ?? "Invalid first name." });
      return;
    }
    const ln = validatePersonName(lastName, "Last name");
    if (!ln.valid) {
      setMessage({ type: "error", text: ln.error ?? "Invalid last name." });
      return;
    }
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setMessage({
        type: "error",
        text: emailResult.error ?? "Invalid email.",
      });
      return;
    }

    const { data: authUserData } = await supabase.auth.getUser();
    const existing = authUserData.user;

    if (existing && !fromInvite) {
      setMessage({
        type: "error",
        text: "You're already signed in. Open the app from your invite link, or go to the dashboard.",
      });
      return;
    }

    if (existing && fromInvite && existing.email?.toLowerCase() !== email.trim().toLowerCase()) {
      setMessage({
        type: "error",
        text: "Email must match the address your invitation was sent to.",
      });
      return;
    }
    const passwordResult = validatePassword(password, { minLength: 6 });
    if (!passwordResult.valid) {
      setMessage({
        type: "error",
        text: passwordResult.error ?? "Invalid password.",
      });
      return;
    }
    const grad = validateExpectedGraduation(expectedGraduation);
    if (!grad.valid) {
      setMessage({
        type: "error",
        text: grad.error ?? "Invalid expected graduation.",
      });
      return;
    }
    if (
      !SIGNUP_MAJOR_OPTIONS.includes(
        major as (typeof SIGNUP_MAJOR_OPTIONS)[number]
      )
    ) {
      setMessage({ type: "error", text: "Please select a major." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const profileData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      major,
      expected_graduation: expectedGraduation.trim(),
    };

    if (existing && fromInvite) {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: profileData,
      });
      setLoading(false);
      if (updateError) {
        setMessage({ type: "error", text: updateError.message });
        return;
      }
      onClose();
      const dest =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(dest);
      router.refresh();
      return;
    }

    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: profileData,
      },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    if (data.session) {
      onClose();
      const dest =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(dest);
      router.refresh();
      return;
    }
    setMessage({
      type: "success",
      text: "Check your email for the confirmation link.",
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSignInClick = () => {
    onClose();
    onOpenSignIn?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md"
        onClick={handleBackdropClick}
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-600/50 bg-zinc-800 p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2
          id="signup-modal-title"
          className="text-2xl font-semibold tracking-tight text-white"
        >
          {fromInvite ? "Finish your account" : "Create an account"}
        </h2>
        <p className="mt-1 text-zinc-300">
          {fromInvite
            ? "Choose a password and confirm your profile to get started."
            : "Add your profile details and choose a password."}
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="signup-first-name"
                className="block text-sm font-medium text-zinc-300"
              >
                First name
              </label>
              <input
                id="signup-first-name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jane"
              />
            </div>
            <div>
              <label
                htmlFor="signup-last-name"
                className="block text-sm font-medium text-zinc-300"
              >
                Last name
              </label>
              <input
                id="signup-last-name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={fromInvite && !!sessionUserId}
              aria-readonly={fromInvite && !!sessionUserId}
              className={`mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                fromInvite && sessionUserId ? "cursor-not-allowed opacity-90" : ""
              }`}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="block text-sm font-medium text-zinc-300"
            >
              Password
            </label>
            <PasswordInput
              id="signup-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-zinc-400">At least 6 characters</p>
          </div>

          <div>
            <label
              htmlFor="signup-graduation"
              className="block text-sm font-medium text-zinc-300"
            >
              Expected graduation
            </label>
            <input
              id="signup-graduation"
              name="expected_graduation"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              required
              maxLength={7}
              placeholder="YYYY-MM"
              title="Year and month: YYYY-MM (months 01–09 use a leading zero)"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              value={expectedGraduation}
              onChange={(e) =>
                setExpectedGraduation(
                  sanitizeExpectedGraduationInput(e.target.value)
                )
              }
              className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Only numbers and a hyphen after the year. Month must be two digits
              (01–09, 10–12), e.g. 2026-05.
            </p>
          </div>

          <div>
            <label
              htmlFor="signup-major"
              className="block text-sm font-medium text-zinc-300"
            >
              Major
            </label>
            <select
              id="signup-major"
              name="major"
              required
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SIGNUP_MAJOR_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.type === "error" ? "text-red-400" : "text-blue-400"
              }`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? fromInvite
                ? "Saving…"
                : "Creating account…"
              : fromInvite
                ? "Complete signup"
                : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          {onOpenSignIn ? (
            <button
              type="button"
              onClick={handleSignInClick}
              className="font-medium text-zinc-400 hover:text-white"
            >
              Sign in
            </button>
          ) : (
            <Link
              href="/login"
              className="font-medium text-zinc-400 hover:text-white"
              onClick={onClose}
            >
              Sign in
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
