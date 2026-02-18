import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const url = next
    ? `/?modal=signin&next=${encodeURIComponent(next)}`
    : "/?modal=signin";
  redirect(url);
}
