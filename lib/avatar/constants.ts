/** Minimum width/height in pixels (square or larger is allowed). */
export const AVATAR_MIN_DIMENSION = 512;

/** Hard cap to keep uploads reasonable (matches typical Storage limits; tune in bucket if needed). */
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export function isAllowedAvatarMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(mime);
}
