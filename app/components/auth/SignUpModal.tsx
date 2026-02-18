"use client";

import { PasswordInput } from "@/app/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { validateEmail, validatePassword } from "@/lib/validation";
import Link from "next/link";
import { useState } from "react";

type SignUpModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
};

export function SignUpModal({ open, onClose, onOpenSignIn }: SignUpModalProps) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setMessage({
        type: "error",
        text: emailResult.error ?? "Invalid email.",
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
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
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

      <div className="relative w-full max-w-md rounded-xl border border-zinc-600/50 bg-zinc-800 p-6 shadow-2xl sm:p-8">
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
          Create an account
        </h2>
        <p className="mt-1 text-zinc-300">
          Enter your email and choose a password.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
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
              className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            {loading ? "Creating account…" : "Sign up"}
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
