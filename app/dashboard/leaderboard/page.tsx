export default function LeaderboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Leaderboard
        </h1>
        <p className="mt-1 text-slate-600 dark:text-zinc-300">
          See how you rank against other members.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-slate-500 dark:text-zinc-400">
          Leaderboard rankings will appear here.
        </p>
      </section>
    </div>
  );
}
