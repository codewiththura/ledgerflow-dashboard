"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Query,
  getDocs,
  limit,
  startAfter,
  query,
  getCountFromServer,
  QueryDocumentSnapshot
} from "firebase/firestore";

interface UsePaginationResult<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  totalCount: number;
  hasMore: boolean;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => Promise<void>;
}

export function useFirestorePagination<T>(
  createQuery: () => Query,
  pageSizeDefault: number = 10,
  deps: any[] = [],
  enabled: boolean = true
): UsePaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [totalCount, setTotalCount] = useState(0);

  // Stack of document snapshots representing the start boundary of each page.
  // pageCursors[0] corresponds to page 1 (which starts at null).
  // pageCursors[1] is the cursor to start page 2, and so on.
  const [pageCursors, setPageCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);

  // Keep createQuery stable to prevent infinite loops, but reference it dynamically.
  const createQueryRef = useRef(createQuery);
  useEffect(() => {
    createQueryRef.current = createQuery;
  }, [createQuery]);

  // Fetch count and reset page state when dependencies change
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    async function fetchCount() {
      try {
        const q = createQueryRef.current();
        const snapshot = await getCountFromServer(q);
        if (active) {
          setTotalCount(snapshot.data().count);
        }
      } catch (err) {
        console.error("Error getting count:", err);
      }
    }

    setPage(1);
    setPageCursors([null]);
    fetchCount();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  // Reset page and cursors when pageSize changes
  useEffect(() => {
    if (!enabled) return;
    setPage(1);
    setPageCursors([null]);
  }, [pageSize, enabled]);

  const fetchPage = useCallback(
    async (pageIndex: number, currentSize: number, cursor: QueryDocumentSnapshot | null) => {
      setLoading(true);
      setError(null);
      try {
        const baseQ = createQueryRef.current();
        let paginatedQ = query(baseQ, limit(currentSize + 1));
        
        if (cursor) {
          paginatedQ = query(baseQ, startAfter(cursor), limit(currentSize + 1));
        }

        const snapshot = await getDocs(paginatedQ);
        const docs = snapshot.docs;
        const hasMorePage = docs.length > currentSize;
        
        const pageDocs = hasMorePage ? docs.slice(0, currentSize) : docs;
        
        const results = pageDocs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
        setItems(results);

        // If there is a next page, save the last document's snapshot as the cursor for the next page
        if (hasMorePage && pageDocs.length > 0) {
          const nextCursor = pageDocs[pageDocs.length - 1];
          setPageCursors(prev => {
            const nextCursors = [...prev];
            nextCursors[pageIndex] = nextCursor;
            return nextCursors;
          });
        }
      } catch (err) {
        console.error("Pagination fetch error:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch current page items
  useEffect(() => {
    if (!enabled) return;
    // Determine the cursor to start this page.
    // Page 1 uses pageCursors[0] (which is null).
    // Page 2 uses pageCursors[1], etc.
    const cursor = pageCursors[page - 1] === undefined ? null : pageCursors[page - 1];
    fetchPage(page, pageSize, cursor);
  }, [page, pageSize, pageCursors, fetchPage, enabled]);

  const nextPage = useCallback(() => {
    if ((page * pageSize) < totalCount) {
      setPage(p => p + 1);
    }
  }, [page, pageSize, totalCount]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(p => p - 1);
    }
  }, [page]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const q = createQueryRef.current();
      const countSnap = await getCountFromServer(q);
      setTotalCount(countSnap.data().count);
    } catch (err) {
      console.error("Error updating count on refresh:", err);
    }
    const cursor = pageCursors[page - 1] === undefined ? null : pageCursors[page - 1];
    await fetchPage(page, pageSize, cursor);
  }, [enabled, page, pageSize, pageCursors, fetchPage]);

  const hasMore = (page * pageSize) < totalCount;

  return {
    items,
    loading,
    error,
    page,
    pageSize,
    setPage,
    setPageSize,
    totalCount,
    hasMore,
    nextPage,
    prevPage,
    refresh
  };
}
