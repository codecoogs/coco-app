"use client";

import { useRef } from "react";

const OTP_LENGTH = 6;

const boxClass =
  "h-12 w-11 rounded-lg border border-zinc-600 bg-zinc-800 text-center text-lg font-semibold text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 sm:h-14 sm:w-12";

type OtpInputProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Six separate digit boxes backed by a single code string. Pasting into any
 * box fills all boxes from the start, regardless of which one has focus.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").replace(/\s+$/, ""));
  };

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    const el = inputRefs.current[clamped];
    el?.focus();
    el?.select();
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit) focusIndex(index + 1);
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        focusIndex(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusIndex(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusIndex(pasted.length - 1);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={boxClass}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
        />
      ))}
    </div>
  );
}
