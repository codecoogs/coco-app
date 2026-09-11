export const DEFAULT_PAGE_SIZE = 20;

export function paginate<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  const start = current * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    pageItems,
    page: current,
    pageCount,
    from: pageItems.length ? start + 1 : 0,
    to: start + pageItems.length,
    total: items.length,
  };
}
