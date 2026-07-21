import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { notFound, redirect } from "next/navigation";
import { getAudienceOptions, getFormForEdit } from "../../../actions";
import { FormBuilderContent } from "./FormBuilderContent";

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect(`/login?next=/dashboard/forms/manage/${formId}/edit`);
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_forms")) {
    redirect("/dashboard");
  }

  const [formRes, audienceRes] = await Promise.all([
    getFormForEdit(formId),
    getAudienceOptions(),
  ]);

  if (formRes.error || !formRes.data) {
    notFound();
  }

  return (
    <FormBuilderContent
      form={formRes.data}
      roleOptions={audienceRes.roles}
      positionOptions={audienceRes.positions}
      audienceError={audienceRes.error}
    />
  );
}
