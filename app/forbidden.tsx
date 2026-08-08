import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "403 - Access Forbidden",
  description: "You don't have permission to access this resource.",
};

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:px-6 lg:px-8">
      {/* Background blur blobs for visual interest */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[20%] right-[10%] h-[20rem] w-[20rem] rounded-full bg-error/5 blur-3xl" />
        <div className="absolute bottom-[10%] left-[5%] h-[15rem] w-[15rem] rounded-full bg-warning/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* Coco Mean Asset */}
        <div className="h-48 w-48 sm:h-56 sm:w-56 lg:h-64 lg:w-64 relative drop-shadow-lg">
          <Image
            src="/images/icons/coco-mean.png"
            alt="Coco mascot - Access denied"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Error Code and Title */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
            403
          </h1>
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            Access Forbidden
          </p>
        </div>

        {/* Error Description */}
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          You don't have permission to access this resource. If you believe this is a mistake, please contact your team administrator.
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
        <div className="mt-4 inline-block rounded-full bg-warning-soft px-4 py-2 text-sm font-medium text-warning border border-warning-border">
          Error Code: 403
        </div>
      </div>
    </div>
  );
}
