'use client'

export function FloatingShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Floating circles */}
      <svg
        className="absolute -left-20 top-[15%] h-32 w-32 animate-float text-white/10"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="40" fill="currentColor" />
      </svg>
      <svg
        className="absolute right-[10%] top-[25%] h-24 w-24 animate-float-delayed text-white/10"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="35" fill="currentColor" />
      </svg>
      <svg
        className="absolute bottom-[20%] left-[20%] h-20 w-20 animate-float text-white/10"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="30" fill="currentColor" />
      </svg>
      <svg
        className="absolute bottom-[30%] right-[25%] h-28 w-28 animate-float-delayed text-white/10"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="38" fill="currentColor" />
      </svg>
      {/* Decorative blobs */}
      <svg
        className="absolute left-[5%] top-[40%] h-40 w-40 animate-float text-white/5"
        viewBox="0 0 120 120"
      >
        <path
          d="M60 10 C90 10 110 40 110 60 C110 90 80 110 60 110 C30 110 10 80 10 60 C10 30 35 10 60 10 Z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute right-[5%] bottom-[15%] h-36 w-36 animate-float-delayed text-white/5"
        viewBox="0 0 120 120"
      >
        <path
          d="M60 15 C95 15 105 50 105 60 C105 95 70 105 60 105 C25 105 15 70 15 60 C15 25 50 15 60 15 Z"
          fill="currentColor"
        />
      </svg>
      {/* Small dots */}
      <svg
        className="absolute left-[30%] top-[10%] h-3 w-3 text-white/20"
        viewBox="0 0 10 10"
      >
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      </svg>
      <svg
        className="absolute right-[35%] top-[60%] h-2 w-2 text-white/20 animate-float"
        viewBox="0 0 10 10"
      >
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      </svg>
      <svg
        className="absolute bottom-[40%] right-[15%] h-2.5 w-2.5 text-white/15 animate-float-delayed"
        viewBox="0 0 10 10"
      >
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      </svg>
    </div>
  )
}
