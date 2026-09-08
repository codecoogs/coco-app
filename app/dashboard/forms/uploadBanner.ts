"use client";

import { safeFileName, uploadWithTimeout } from "@/lib/supabase/upload";
import type { createClient } from "@/lib/supabase/client";

/** Shared by the form-level and section-level banner uploads in the builder. */
export async function uploadFormBanner(
  supabase: ReturnType<typeof createClient>,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const path = `form-banners/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  const { error } = await uploadWithTimeout(supabase, "assets", path, file, {
    label: "Banner upload",
  });
  if (error) return { url: null, error };

  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
