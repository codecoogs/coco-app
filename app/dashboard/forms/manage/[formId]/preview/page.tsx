import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { notFound, redirect } from "next/navigation";
import { getFormForEdit } from "../../../actions";
import { FormPreviewContent } from "./FormPreviewContent";

export default async function FormPreviewPage({
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
    redirect(`/login?next=/dashboard/forms/manage/${formId}/preview`);
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_forms")) {
    redirect("/dashboard");
  }

  const { data, error } = await getFormForEdit(formId);
  if (error || !data) {
    notFound();
  }

  return <FormPreviewContent form={data} />;
}
