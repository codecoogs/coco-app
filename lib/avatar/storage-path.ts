const BUCKET = "avatars";

/**
 * Object path in Storage API: `{authId}/{fileName}` (no leading slash).
 */
export function avatarObjectPathForAuthId(authId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${authId}/${safe}`;
}

export function storagePathFromPublicUrl(publicUrl: string): string | null {
  const needle = `/object/public/${BUCKET}/`;
  const i = publicUrl.indexOf(needle);
  if (i === -1) return null;
  try {
    return decodeURIComponent(publicUrl.slice(i + needle.length));
  } catch {
    return null;
  }
}

export { BUCKET as AVATAR_BUCKET_ID };
