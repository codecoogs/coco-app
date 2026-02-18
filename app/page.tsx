"use client";

import { SignInModal } from "@/app/components/auth/SignInModal";
import { SignUpModal } from "@/app/components/auth/SignUpModal";
import { TeamSignInModal } from "@/app/components/auth/TeamSignInModal";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function HomePageContent() {
  const searchParams = useSearchParams();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [teamSignInOpen, setTeamSignInOpen] = useState(false);

  useEffect(() => {
    const modal = searchParams.get("modal");
    if (modal === "signin") setSignInOpen(true);
    else if (modal === "signup") setSignUpOpen(true);
    else if (modal === "team") setTeamSignInOpen(true);
  }, [searchParams]);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-zinc-950 lg:flex-row">
        <div className="relative flex min-h-[45vh] flex-col lg:min-h-screen lg:w-[50%]">
          <div className="absolute left-6 top-6 lg:left-8 lg:top-8">
            <Link href="/" className="block" aria-label="Coco home">
              <Image
                src="/images/logos/logo-white.png"
                alt="Coco"
                width={240}
                height={84}
                className="h-10 w-auto object-contain md:h-18"
                priority
              />
            </Link>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 lg:py-12">
            <div className="relative aspect-square w-full max-w-56">
              <Image
                src="/images/icons/coco-nice.png"
                alt=""
                fill
                className="object-contain"
                sizes="24rem"
                priority
              />
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[55vh] flex-1 flex-col border-zinc-800/60 bg-zinc-900 lg:min-h-screen lg:border-l">
          <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-12 lg:px-16">
            <div className="absolute right-6 top-6 lg:right-8 lg:top-8">
              <button
                type="button"
                onClick={() => setTeamSignInOpen(true)}
                className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white hover:cursor-pointer"
              >
                Team login
              </button>
            </div>

            <div className="mx-auto w-full max-w-sm">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Welcome to Coco
              </h1>
              <p className="mt-4 text-base text-zinc-400">
                The CodeCoogs platform for member points, events, and more.{" "}
                <br />
                Please sign in to continue.
              </p>

              <div className="mt-10 flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setSignInOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 py-3.5 text-base font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 hover:cursor-pointer"
                >
                  Sign in
                </button>

                <div className="flex items-center gap-4">
                  <span className="h-px flex-1 bg-zinc-700" />
                  <span className="text-sm text-zinc-500">or</span>
                  <span className="h-px flex-1 bg-zinc-700" />
                </div>

                <button
                  type="button"
                  onClick={() => setSignUpOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-600 bg-transparent py-3.5 text-base font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 hover:cursor-pointer"
                >
                  Sign up
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-zinc-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setSignUpOpen(true)}
                  className="font-medium text-zinc-400 hover:text-white hover:cursor-pointer"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        next={searchParams.get("next") ?? "/dashboard"}
      />
      <SignUpModal
        open={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onOpenSignIn={() => setSignInOpen(true)}
      />
      <TeamSignInModal
        open={teamSignInOpen}
        onClose={() => setTeamSignInOpen(false)}
        onOpenSignIn={() => setSignInOpen(true)}
        next="/dashboard"
      />
    </>
  );
}

function HomePageFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 lg:flex-row">
      <div className="relative flex min-h-[45vh] flex-col lg:min-h-screen lg:w-[50%]" />
      <div className="relative flex min-h-[55vh] flex-1 flex-col border-zinc-800/60 bg-zinc-900 lg:min-h-screen lg:border-l" />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
