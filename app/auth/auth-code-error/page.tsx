import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4">
      <h1 className="text-2xl font-semibold text-slate-900">
        Something went wrong
      </h1>
      <p className="max-w-sm text-center text-slate-600">
        We couldn’t complete sign in. Please try again or use a different method.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-sky-600 px-6 py-3 font-medium text-white transition hover:bg-sky-700"
      >
        Back to sign in
      </Link>
    </div>
  )
}
