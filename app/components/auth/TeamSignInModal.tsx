"use client";

import { PasswordInput } from "@/app/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { validateEmail, validatePassword } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TeamSignInModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
  next?: string;
};

export function TeamSignInModal({
  open,
  onClose,
  onOpenSignIn,
  next = "/dashboard",
}: TeamSignInModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setMessage({ type: "error", text: emailResult.error ?? "Invalid email." });
      return;
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      setMessage({ type: "error", text: passwordResult.error ?? "Invalid password." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    onClose();
    router.push(next);
    router.refresh();
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
      aria-labelledby="team-modal-title"
    >
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
        onClick={handleBackdropClick}
      />

      <div className="relative w-full max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 shadow-2xl sm:p-8">
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

        <div className="mb-2 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
          Officers only
        </div>
        <h2
          id="team-modal-title"
          className="text-2xl font-semibold tracking-tight text-white"
        >
          Team login
        </h2>
        <p className="mt-1 text-zinc-400">
          Sign in with your organization officer account.
        </p>

        <form onSubmit={handleTeamLogin} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="team-modal-email"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="team-modal-email"
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
              htmlFor="team-modal-password"
              className="block text-sm font-medium text-zinc-300"
            >
              Password
            </label>
            <PasswordInput
              id="team-modal-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1"
            />
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
            {loading ? "Signing in…" : "Team sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Not an officer?{" "}
          <button
            type="button"
            onClick={onOpenSignIn ? handleSignInClick : onClose}
            className="font-medium text-zinc-400 hover:text-white"
          >
            Standard sign in
          </button>
        </p>
      </div>
    </div>
  );
}
