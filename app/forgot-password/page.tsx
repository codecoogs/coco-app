"use client";

import { OtpInput } from "@/app/components/ui/OtpInput";
import { PasswordInput } from "@/app/components/ui/PasswordInput";
import { validateEmail, validatePassword } from "@/lib/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useResendCountdown } from "@/lib/otp/use-resend-countdown";
import {
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  verifyPasswordResetOtpAndSetPassword,
} from "./actions";


/**
 * Wrapped in Suspense below because useSearchParams opts the subtree into
 * client-side rendering and Next refuses to build a page that reads it
 * without a boundary.
 */
function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefilled by the reinvite email, so someone who already stalled once on
  // verification does not have to retype the address we just wrote to.
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [loading, setLoading] = useState(false);
  const { secondsLeft, ready: resendReady, start: startResendCooldown } =
    useResendCountdown();
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setMessage({
        type: "error",
        text: emailResult.error ?? "Invalid email.",
      });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { retryAfterSeconds } = await requestPasswordResetOtp(email);
    setLoading(false);
    setCode("");
    setStep("reset");
    startResendCooldown(retryAfterSeconds);
    setMessage({
      type: "success",
      text: "If that email has an account, we sent it a 6-digit code.",
    });
  };

  const handleResend = async () => {
    if (!resendReady) return;
    setLoading(true);
    setMessage(null);
    const { retryAfterSeconds } = await resendPasswordResetOtp(email);
    setLoading(false);
    startResendCooldown(retryAfterSeconds);
    setMessage({ type: "success", text: "Code resent." });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setMessage({ type: "error", text: "Enter all 6 digits." });
      return;
    }
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
    const result = await verifyPasswordResetOtpAndSetPassword({
      email,
      code,
      newPassword: password,
    });
    setLoading(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-600/50 bg-zinc-800 p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {step === "reset" ? "Enter code & set password" : "Reset password"}
        </h1>
        <p className="mt-1 text-zinc-300">
          {step === "reset"
            ? `Enter the 6-digit code we sent to ${email} and choose a new password.`
            : "Enter your email and we'll send you a 6-digit code."}
        </p>

        {step === "reset" ? (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <OtpInput value={code} onChange={setCode} autoFocus />
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
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || !resendReady}
              className="w-full text-center text-sm font-medium text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendReady ? "Resend code" : `Resend code in ${secondsLeft}s`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
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
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/" className="font-medium text-zinc-400 hover:text-white">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
