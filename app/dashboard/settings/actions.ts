"use server";

import {
  AVATAR_MAX_FILE_BYTES,
  isAllowedAvatarMime,
} from "@/lib/avatar/constants";
import {
  AVATAR_BUCKET_ID,
  avatarObjectPathForAuthId,
  storagePathFromPublicUrl,
} from "@/lib/avatar/storage-path";
import { createClient } from "@/lib/supabase/server";
import {
  sanitizeExpectedGraduationInput,
  validateExpectedGraduation,
  validatePersonName,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "img";
}

export type UploadProfileAvatarResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; error: string };

/**
 * Server-side upload: validates type/size, stores under `avatars/{auth.uid()}/...`,
 * then sets `public.users.avatar_url` via `set_user_avatar` (no broad client UPDATE on users).
 * Minimum dimensions (512×512) must be validated in the browser before calling this.
 */
export async function uploadProfileAvatar(
  formData: FormData
): Promise<UploadProfileAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Not signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (!isAllowedAvatarMime(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large." };
  }
  if (file.size < 1) {
    return { ok: false, error: "File is empty." };
  }

  const { data: row } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  const oldUrl = (row as { avatar_url: string | null } | null)?.avatar_url
    ?.trim();

  const ext = extFromMime(file.type);
  const fileName = `avatar-${Date.now()}.${ext}`;
  const objectPath = avatarObjectPathForAuthId(user.id, fileName);

  const body = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET_ID)
    .upload(objectPath, body, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { data: pub } = supabase.storage
    .from(AVATAR_BUCKET_ID)
    .getPublicUrl(objectPath);
  const publicUrl = pub.publicUrl;

  const { error: rpcErr } = await supabase.rpc("set_user_avatar", {
    p_url: publicUrl,
  });

  if (rpcErr) {
    await supabase.storage.from(AVATAR_BUCKET_ID).remove([objectPath]);
    return { ok: false, error: rpcErr.message };
  }

  if (oldUrl) {
    const oldPath = storagePathFromPublicUrl(oldUrl);
    if (oldPath && oldPath !== objectPath) {
      await supabase.storage.from(AVATAR_BUCKET_ID).remove([oldPath]);
    }
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, avatarUrl: publicUrl };
}

export type UpdateMyProfileResult =
  | { ok: true }
  | { ok: false; error: string };

function trimOrEmpty(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function updateMyProfile(
  formData: FormData
): Promise<UpdateMyProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const first_name = trimOrEmpty(formData.get("first_name"));
  const last_name = trimOrEmpty(formData.get("last_name"));
  const phone = trimOrEmpty(formData.get("phone"));
  const classification = trimOrEmpty(formData.get("classification"));
  const expected_graduation = sanitizeExpectedGraduationInput(
    trimOrEmpty(formData.get("expected_graduation")),
  ).trim();
  const major = trimOrEmpty(formData.get("major"));

  const fn = validatePersonName(first_name, "First name");
  if (!fn.valid) return { ok: false, error: fn.error ?? "Invalid first name." };
  const ln = validatePersonName(last_name, "Last name");
  if (!ln.valid) return { ok: false, error: ln.error ?? "Invalid last name." };
  const grad = validateExpectedGraduation(expected_graduation);
  if (!grad.valid) {
    return { ok: false, error: grad.error ?? "Invalid expected graduation." };
  }

  if (phone.length > 50) return { ok: false, error: "Phone number is too long." };
  if (classification.length > 100) {
    return { ok: false, error: "Classification is too long." };
  }
  if (major.length > 150) return { ok: false, error: "Major is too long." };

  const { error } = await supabase.rpc("update_my_profile", {
    p_first_name: first_name,
    p_last_name: last_name,
    p_phone: phone,
    p_classification: classification,
    p_expected_graduation: expected_graduation,
    p_major: major,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
