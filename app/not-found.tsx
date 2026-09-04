import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "404 - Page Not Found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:px-6 lg:px-8">
      {/* Background blur blobs for visual interest */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[20%] left-[10%] h-[20rem] w-[20rem] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] h-[15rem] w-[15rem] rounded-full bg-fuchsia-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* Coco Nice Asset */}
        <div className="h-48 w-48 sm:h-56 sm:w-56 lg:h-64 lg:w-64 relative drop-shadow-lg">
          <Image
            src="/images/icons/coco-nice.png"
            alt="Coco mascot - Page not found"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Error Code and Title */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
            404
          </h1>
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            Page Not Found
          </p>
        </div>

        {/* Error Description */}
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 font-medium text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Go Home
          </Link>
        </div>

        {/* Status Badge */}
        <div className="mt-4 inline-block rounded-full bg-error-soft px-4 py-2 text-sm font-medium text-error border border-error-border">
          Error Code: 404
        </div>
      </div>
    </div>
  );
}
