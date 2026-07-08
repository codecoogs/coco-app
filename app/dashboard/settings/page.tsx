import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DiscordLinkSection } from "./DiscordLinkSection";
import { ProfileAvatarSection } from "./ProfileAvatarSection";
import { ProfileDetailsSection } from "./ProfileDetailsSection";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect("/login?next=/dashboard/settings");
  }

  const { data: row } = await supabase
    .from("users")
    .select(
      "avatar_url, first_name, last_name, phone, classification, expected_graduation, major, discord, updated",
    )
    .eq("auth_id", user.id)
    .maybeSingle();

  const u = row as
    | {
        avatar_url: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        classification: string | null;
        expected_graduation: string | null;
        major: string | null;
        discord: string | null;
        updated: string | null;
      }
    | null;

  const avatarUrl = u?.avatar_url?.trim() ?? null;
  const profileSectionKey = u?.updated ?? "no-row";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile. More options will be available here later.
        </p>
      </div>

      <ProfileAvatarSection
        key={profileSectionKey}
        initialAvatarUrl={avatarUrl}
      />
      <ProfileDetailsSection
        key={profileSectionKey}
        initial={{
          first_name: u?.first_name ?? "",
          last_name: u?.last_name ?? "",
          phone: u?.phone ?? "",
          classification: u?.classification ?? "",
          expected_graduation: u?.expected_graduation ?? "",
          major: u?.major ?? null,
          discord: u?.discord ?? null,
        }}
      />
      <DiscordLinkSection />
    </div>
  );
}
