import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const query =
    from === "invite" ? "modal=signup&from=invite" : "modal=signup";
  redirect(`/?${query}`);
}
