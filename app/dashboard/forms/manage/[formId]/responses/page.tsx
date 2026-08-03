import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { notFound, redirect } from "next/navigation";
import { getFormForEdit, getResponses } from "../../../actions";
import { FormResponsesContent } from "./FormResponsesContent";

export default async function FormResponsesPage({
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
    redirect(`/login?next=/dashboard/forms/manage/${formId}/responses`);
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_forms")) {
    redirect("/dashboard");
  }

  const [formRes, responsesRes] = await Promise.all([
    getFormForEdit(formId),
    getResponses(formId),
  ]);

  if (formRes.error || !formRes.data) {
    notFound();
  }

  return (
    <FormResponsesContent
      formId={formId}
      formTitle={formRes.data.title}
      questions={responsesRes.questions}
      initialResponses={responsesRes.responses}
      loadError={responsesRes.error}
    />
  );
}
