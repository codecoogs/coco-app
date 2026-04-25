"use client";

import { AVATAR_MAX_FILE_BYTES, AVATAR_MIN_DIMENSION, isAllowedAvatarMime } from "./constants";

export type AvatarValidationError =
  | { ok: false; message: string }
  | { ok: true; width: number; height: number };

/**
 * Validates file type, size, and minimum dimensions in the browser (required before upload).
 * Uses a bitmap decode so dimensions reflect the real image, not the container.
 */
export async function validateAvatarFileClient(
  file: File
): Promise<AvatarValidationError> {
  if (!isAllowedAvatarMime(file.type)) {
    return {
      ok: false,
      message: "Use a JPEG, PNG, or WebP image.",
    };
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `Image must be at most ${AVATAR_MAX_FILE_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (file.size < 1) {
    return { ok: false, message: "File is empty." };
  }

  let width = 0;
  let height = 0;
  try {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    return { ok: false, message: "Could not read this image. Try a different file." };
  }

  if (width < AVATAR_MIN_DIMENSION || height < AVATAR_MIN_DIMENSION) {
    return {
      ok: false,
      message: `Image must be at least ${AVATAR_MIN_DIMENSION}×${AVATAR_MIN_DIMENSION} pixels (this file is ${width}×${height}).`,
    };
  }

  return { ok: true, width, height };
}
