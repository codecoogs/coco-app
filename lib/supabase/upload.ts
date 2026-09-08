import type { SupabaseClient } from "@supabase/supabase-js";

/** Strips anything Storage object keys can't carry safely. */
export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Uploads to Storage with a timeout.
 *
 * storage-js has no built-in timeout (unlike functions.invoke), so a stalled
 * request never settles and whatever spinner the caller set stays up forever
 * with no error to act on. Every upload in the app routes through here so the
 * guard exists once rather than being re-derived per call site.
 *
 * Returns the object path on success; callers on a public bucket can pass it
 * to getPublicUrl, callers on a private one store it as-is.
 */
export async function uploadWithTimeout(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  options?: { timeoutMs?: number; label?: string }
): Promise<{ path: string | null; error: string | null }> {
  const label = options?.label ?? "Upload";
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`${label} timed out. Check your connection and try again.`)
        ),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([
      supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      }),
      timeout,
    ]);
    if (result.error) return { path: null, error: result.error.message };
    return { path, error: null };
  } catch (err) {
    return {
      path: null,
      error: err instanceof Error ? err.message : `${label} failed.`,
    };
  } finally {
    // Without this the pending timer keeps the promise (and its reject) alive
    // after a fast success, firing an unhandled rejection ~20s later.
    if (timer) clearTimeout(timer);
  }
}
