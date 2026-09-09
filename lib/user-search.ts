export type SearchableUser = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  discord?: string | null;
};

/**
 * Token-AND match over name, email and Discord handle. Lifted out of the
 * officers page so the point-management member picker behaves identically -
 * "ada l" and "l ada" both find Ada Lovelace, and neither finds anyone else.
 *
 * An empty query returns nothing on purpose: these are type-ahead pickers, and
 * dumping every user into the dropdown on focus is noise.
 */
export function filterUsersByQuery<T extends SearchableUser>(
  users: T[],
  query: string,
  limit = 40
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  return users
    .filter((u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
      const haystack = `${name} ${(u.email ?? "").toLowerCase()} ${(u.discord ?? "").toLowerCase()}`;
      return tokens.every((t) => haystack.includes(t));
    })
    .slice(0, limit);
}
