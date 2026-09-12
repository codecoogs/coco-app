// Extension is required so `npm test` (node --experimental-strip-types) can
// resolve these; tsconfig sets allowImportingTsExtensions for the same reason.
import { escapeHtml, type RenderedEmail } from "./invites.ts";

/**
 * The Sunday digest. It lists every open task an officer holds, not just the
 * ones due this week: the mail goes out once a week, so a task handed over on
 * Tuesday would otherwise never appear in one until it was already late.
 *
 * Overdue work is called out in the subject line, because that is the part
 * someone reading on a phone needs to see without opening anything.
 */

export type DigestTask = {
  title: string;
  boardName: string;
  columnName: string;
  /** ISO timestamp, or null for a task with no due date. */
  dueAt: string | null;
  priority: string;
};

export type TaskDigestParams = {
  firstName: string | null;
  tasks: DigestTask[];
  /** Origin only, no trailing slash - see getSiteUrl(). */
  siteUrl: string;
  /** Overridable so the grouping can be tested against a fixed week. */
  now?: Date;
};

export type DigestGroups = {
  overdue: DigestTask[];
  thisWeek: DigestTask[];
  later: DigestTask[];
  undated: DigestTask[];
};

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupDigestTasks(tasks: DigestTask[], now: Date = new Date()): DigestGroups {
  const today = startOfDay(now);
  const weekEnd = today + 7 * DAY_MS;
  const groups: DigestGroups = { overdue: [], thisWeek: [], later: [], undated: [] };

  for (const task of tasks) {
    if (!task.dueAt) {
      groups.undated.push(task);
      continue;
    }
    const due = new Date(task.dueAt).getTime();
    if (due < today) groups.overdue.push(task);
    else if (due <= weekEnd) groups.thisWeek.push(task);
    else groups.later.push(task);
  }

  return groups;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "no due date";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderTaskRow(task: DigestTask): string {
  const meta = [task.boardName, task.columnName, formatDue(task.dueAt), task.priority]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join(" &middot; ");

  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:15px;color:#111827;font-weight:600;">${escapeHtml(task.title)}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px;">${meta}</div>
      </td>
    </tr>`;
}

function renderSection(heading: string, tasks: DigestTask[], accent: string): string {
  if (!tasks.length) return "";
  return `
    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:${accent};margin:24px 0 4px;">
      ${escapeHtml(heading)} (${tasks.length})
    </h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${tasks.map(renderTaskRow).join("")}
    </table>`;
}

/** Returns null when there is nothing to say, so the caller sends no mail. */
export function renderTaskDigestEmail(params: TaskDigestParams): RenderedEmail | null {
  const { firstName, tasks, siteUrl } = params;
  if (!tasks.length) return null;

  const now = params.now ?? new Date();
  const groups = groupDigestTasks(tasks, now);
  const name = firstName?.trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi there,";

  const total = tasks.length;
  const overdueCount = groups.overdue.length;
  const subject =
    `Your week: ${total} open task${total === 1 ? "" : "s"}` +
    (overdueCount ? `, ${overdueCount} overdue` : "");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
            <tr>
              <td>
                <div style="font-size:18px;font-weight:700;color:#c8102e;">CodeCoogs</div>
                <p style="font-size:15px;color:#111827;margin:18px 0 0;">${greeting}</p>
                <p style="font-size:15px;color:#374151;margin:8px 0 0;">
                  Here is what is on your plate this week.
                </p>

                ${renderSection("Overdue", groups.overdue, "#b91c1c")}
                ${renderSection("Due this week", groups.thisWeek, "#b45309")}
                ${renderSection("Later", groups.later, "#374151")}
                ${renderSection("No due date", groups.undated, "#6b7280")}

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                  <tr>
                    <td style="background:#c8102e;border-radius:8px;">
                      <a href="${siteUrl}/dashboard/tasks"
                         style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                        Open your board
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="font-size:13px;color:#6b7280;margin:24px 0 0;">
                  You are getting this because you hold an officer position with open tasks.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
