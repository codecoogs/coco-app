import { NextRequest, NextResponse } from "next/server";

/** Your CodeCoogs API base (e.g. https://api.codecoogs.com/v1). Set in .env as NEXT_PUBLIC_CODECOOGS_API_URL or CODECOOGS_API_URL. */
const UPSTREAM =
  process.env.CODECOOGS_API_URL ??
  process.env.NEXT_PUBLIC_CODECOOGS_API_URL ??
  "https://api.codecoogs.com/v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = new URL(pathStr, UPSTREAM.endsWith("/") ? UPSTREAM : `${UPSTREAM}/`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 502 }
    );
  }
}
