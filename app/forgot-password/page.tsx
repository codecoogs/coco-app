"use client";

import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validation";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setMessage({ type: "error", text: emailResult.error ?? "Invalid email." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const redirectTo = `${
      window.location.origin
    }/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({
      type: "success",
      text: "Check your email for a link to reset your password.",
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Reset password
        </h1>
        <p className="mt-1 text-zinc-400">
          Enter your email and we’ll send you a link to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="forgot-email"
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="font-medium text-zinc-400 hover:text-white">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
