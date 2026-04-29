"use client";

import { SignInModal } from "@/app/components/auth/SignInModal";
import { SignUpModal } from "@/app/components/auth/SignUpModal";
import { TeamSignInModal } from "@/app/components/auth/TeamSignInModal";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/** Large soft gradients read as blurry color blobs behind content (flat bg stays zinc-900). */
function HeroBlurBlobs({
  mirrored = false,
}: {
  /** Right column blob positions mirrored for balance */
  mirrored?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className={
          mirrored
            ? "absolute top-[14%] h-[min(22rem,50vw)] w-[min(22rem,50vw)] rounded-full bg-blue-600/5 blur-3xl sm:-right-[8%]"
            : "absolute top-[12%] h-[min(22rem,50vw)] w-[min(22rem,50vw)] rounded-full bg-blue-600/8 blur-3xl sm:-left-[6%]"
        }
      />
      <div
        className={
          mirrored
            ? "absolute bottom-[8%] h-[min(20rem,45vw)] w-[min(20rem,45vw)] rounded-full bg-fuchsia-600/2 blur-3xl sm:-left-[20%]"
            : "absolute bottom-[8%] h-[min(20rem,45vw)] w-[min(20rem,45vw)] rounded-full bg-fuchsia-600/2 blur-3xl sm:-right-[20%]"
        }
      />
    </div>
  );
}

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
      <div className="flex min-h-screen flex-col bg-zinc-900 lg:flex-row lg:min-h-0">
        {/* Hero art: large screens only */}
        <aside
          aria-hidden
          className="relative hidden min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-900 lg:flex lg:max-w-[52%] xl:max-w-none"
        >
          <HeroBlurBlobs />
          <div className="relative z-10 flex w-full flex-1 items-center justify-center px-10 py-16 lg:py-24">
            <Image
              src="/images/icons/coco-nice.png"
              alt=""
              width={560}
              height={560}
              className="h-auto w-full max-w-md object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.5)] xl:max-w-lg"
              priority
              sizes="(min-width: 1280px) 36rem, (min-width: 1024px) 42vw, 100vw"
            />
          </div>
        </aside>

        <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-zinc-900 lg:min-h-0 lg:flex-1 lg:border-l lg:border-zinc-800/20">
          <HeroBlurBlobs mirrored />
          <div className="absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label="Coco home"
            >
              <Image
                src="/images/logos/logo+border-removebg-preview.png"
                alt="CodeCoogs"
                width={400}
                height={220}
                className="h-10 w-auto object-contain sm:h-12"
                priority
              />
            </Link>
          </div>

          <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
            <button
              type="button"
              onClick={() => setTeamSignInOpen(true)}
              className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              Team login
            </button>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-24 sm:px-8 lg:py-14">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Welcome to Coco
              </h1>
              <p className="mt-3 text-base text-zinc-300">
                The CodeCoogs platform for member points, events, and more.
                Please sign in to continue.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:mt-8">
                <button
                  type="button"
                  onClick={() => setSignInOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 py-3.5 text-base font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
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
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-600 bg-transparent py-3.5 text-base font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  Sign up
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-zinc-400 sm:text-start">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setSignUpOpen(true)}
                  className="font-medium text-zinc-300 hover:text-white"
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
        next={searchParams.get("next") ?? "/dashboard"}
        fromInvite={searchParams.get("from") === "invite"}
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
    <div className="flex min-h-screen flex-col bg-zinc-900 lg:flex-row lg:min-h-0">
      <div className="relative hidden flex-1 overflow-hidden bg-zinc-900 lg:block lg:max-w-[52%] xl:max-w-none">
        <HeroBlurBlobs />
      </div>
      <div className="relative flex-1 overflow-hidden bg-zinc-900 lg:border-l lg:border-zinc-800/80">
        <HeroBlurBlobs mirrored />
      </div>
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
