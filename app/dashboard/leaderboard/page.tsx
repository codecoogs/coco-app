export default function LeaderboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Leaderboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          See how you rank against other members.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-muted-foreground">
          Leaderboard rankings will appear here.
        </p>
      </section>
    </div>
  );
}
