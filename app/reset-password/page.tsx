"use client";

import { PasswordInput } from "@/app/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [noSession, setNoSession] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNoSession(!user);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: "error", text: "Passwords do not match." });
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
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  if (noSession === true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-600/50 bg-zinc-800 p-6 shadow-2xl sm:p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Link expired or invalid
          </h1>
          <p className="mt-2 text-zinc-300">
            This reset link may have expired. Request a new one below.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-500"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-600/50 bg-zinc-800 p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Set new password
        </h1>
        <p className="mt-1 text-zinc-300">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-zinc-300"
            >
              New password
            </label>
            <PasswordInput
              id="new-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-zinc-300"
            >
              Confirm password
            </label>
            <PasswordInput
              id="confirm-password"
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
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
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/" className="font-medium text-zinc-400 hover:text-white">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
