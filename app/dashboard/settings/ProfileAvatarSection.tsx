"use client";

import { validateAvatarFileClient } from "@/lib/avatar/validate-client";
import { uploadProfileAvatar } from "./actions";
import Image from "next/image";
import { useCallback, useState } from "react";

type Props = {
  initialAvatarUrl: string | null;
};

export function ProfileAvatarSection({ initialAvatarUrl }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setMessage(null);
      const check = await validateAvatarFileClient(file);
      if (!check.ok) {
        setMessage({ type: "error", text: check.message });
        return;
      }

      setBusy(true);
      const formData = new FormData();
      formData.set("file", file);
      const res = await uploadProfileAvatar(formData);
      setBusy(false);

      if (res.ok) {
        setAvatarUrl(res.avatarUrl);
        setMessage({ type: "ok", text: "Profile picture updated." });
      } else {
        setMessage({ type: "error", text: res.error });
      }
    },
    []
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">
        Profile picture
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Square images look best. Minimum size {512}×{512} pixels. JPEG, PNG, or
        WebP, up to 5 MB.
      </p>

      {message && (
        <p
          className={
            message.type === "ok"
              ? "mt-3 text-sm text-green-700 dark:text-green-300"
              : "mt-3 text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
              aria-hidden
            >
              No photo
            </div>
          )}
        </div>
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={onChange}
            className="text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5"
          />
          {busy && (
            <p className="mt-2 text-sm text-muted-foreground">Uploading…</p>
          )}
        </div>
      </div>
    </section>
  );
}
