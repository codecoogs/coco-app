"use client";

import type { createClient } from "@/lib/supabase/client";

/**
 * Shared by the form-level and section-level banner uploads in the builder.
 * storage-js has no built-in timeout, so a stalled upload would otherwise
 * leave the builder on "Saving..." forever with no error to act on - see the
 * identical guard around the event flyer upload in EventFormModal.tsx.
 */
export async function uploadFormBanner(
  supabase: ReturnType<typeof createClient>,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `form-banners/${crypto.randomUUID()}-${safeName}`;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Banner upload timed out. Check your connection and try again.")),
      20000
    )
  );

  let result: { error: { message: string } | null };
  try {
    result = await Promise.race([
      supabase.storage.from("assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      }),
      timeout,
    ]);
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Banner upload failed." };
  }

  if (result.error) return { url: null, error: result.error.message };

  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
