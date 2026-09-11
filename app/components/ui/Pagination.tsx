"use client";

import { DEFAULT_PAGE_SIZE, paginate } from "@/lib/pagination";
import { useState } from "react";
import { Button } from "./Button";

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  return { ...paginate(items, page, pageSize), setPage };
}

type Props = {
  pagination: ReturnType<typeof usePagination<unknown>>;
};

export function PaginationControls({ pagination }: Props) {
  const { page, pageCount, from, to, total, setPage } = pagination;
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
