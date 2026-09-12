import { sendEmail } from "@/lib/email/send";
import { renderTaskDigestEmail, type DigestTask } from "@/lib/email/task-digest";
import { getSiteUrl } from "@/lib/site-url";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

/**
 * The Sunday digest. Vercel calls this on a schedule; the bearer check is the
 * only thing standing between it and the open internet, so it runs before any
 * work happens.
 *
 * Cron schedules are UTC, so 8am Central is a different UTC hour either side
 * of daylight saving. vercel.json fires this at both hours and the run that is
 * not 8am locally stops here, which keeps the send time steady year round.
 *
 * Every officer with an open task hears from us, not just the ones with
 * something due this week: the mail goes out once a week, so a task handed
 * over on Tuesday would otherwise never show up in one until it was late.
 */

export const dynamic = "force-dynamic";

const TIME_ZONE = "America/Chicago";
const SEND_HOUR = 8;

function centralHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
}

/** yyyy-mm-dd in Central. The job runs on Sunday, so this is the week's start. */
function centralDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

type AssignmentRow = {
  user_id: string;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  task_items: {
    title: string;
    due_at: string | null;
    priority: string;
    completed_at: string | null;
    task_boards: { name: string } | null;
    task_columns: { name: string } | null;
  } | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const hour = centralHour(now);
  if (hour !== SEND_HOUR) {
    return NextResponse.json({ skipped: true, reason: `${hour}:00 Central, not ${SEND_HOUR}:00` });
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service role key is not configured." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("task_assignees")
    .select(
      "user_id, users!task_assignees_user_id_fkey (id, first_name, last_name, email), task_items!inner (title, due_at, priority, completed_at, task_boards (name), task_columns!task_items_column_board_fkey (name))"
    )
    .is("task_items.completed_at", null);

  if (error) {
    console.error(`Weekly task digest could not read assignments: ${error.message}`);
    return NextResponse.json({ error: "Could not read assignments." }, { status: 500 });
  }

  const byUser = new Map<
    string,
    { firstName: string | null; email: string; tasks: DigestTask[] }
  >();

  for (const row of (data ?? []) as unknown as AssignmentRow[]) {
    const user = first(row.users);
    const item = first(row.task_items);
    if (!user?.email || !item) continue;

    const entry = byUser.get(user.id) ?? {
      firstName: user.first_name,
      email: user.email,
      tasks: [],
    };
    entry.tasks.push({
      title: item.title,
      boardName: first(item.task_boards)?.name ?? "",
      columnName: first(item.task_columns)?.name ?? "",
      dueAt: item.due_at,
      priority: item.priority,
    });
    byUser.set(user.id, entry);
  }

  const weekStart = centralDate(now);
  const siteUrl = getSiteUrl();
  let sent = 0;
  let alreadySent = 0;
  let failed = 0;

  for (const [userId, entry] of byUser) {
    const rendered = renderTaskDigestEmail({
      firstName: entry.firstName,
      tasks: entry.tasks,
      siteUrl,
      now,
    });
    if (!rendered) continue;

    // Claim the send before mailing: if this week's row already exists the
    // digest went out and a retried run must not send it twice.
    const { error: claimError } = await supabase
      .from("task_digest_sends")
      .insert({ user_id: userId, week_start: weekStart, task_count: entry.tasks.length });

    if (claimError) {
      if (claimError.code === "23505") {
        alreadySent += 1;
        continue;
      }
      console.error(`Weekly task digest could not claim a send: ${claimError.message}`);
      failed += 1;
      continue;
    }

    const result = await sendEmail({
      to: entry.email,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (result.error) {
      // Give the claim back so the next run can try this officer again.
      await supabase
        .from("task_digest_sends")
        .delete()
        .eq("user_id", userId)
        .eq("week_start", weekStart);
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ week_start: weekStart, sent, already_sent: alreadySent, failed });
}
