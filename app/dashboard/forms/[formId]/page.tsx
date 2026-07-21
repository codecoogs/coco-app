import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getFormToFill } from "../actions";
import { FormFillContent } from "./FormFillContent";

export default async function FormFillPage({
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
    redirect(`/login?next=/dashboard/forms/${formId}`);
  }

  const { form, answers, responseId, error } = await getFormToFill(formId);

  if (error || !form) {
    notFound();
  }

  return (
    <FormFillContent
      form={form}
      initialAnswers={answers}
      initialResponseId={responseId}
    />
  );
}
