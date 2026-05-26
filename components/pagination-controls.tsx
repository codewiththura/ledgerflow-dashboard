"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageSizeChange: (size: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  hasMore: boolean;
  loading?: boolean;
}

export function PaginationControls({
  page,
  pageSize,
  totalCount,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  hasMore,
  loading = false,
}: PaginationControlsProps) {
  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-card font-sans text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(val) => onPageSizeChange(parseInt(val, 10))}
          disabled={loading}
        >
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue placeholder={pageSize.toString()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-2 text-xs sm:text-sm">
          Showing {fromRecord} - {toRecord} of {totalCount} records
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevPage}
          disabled={page <= 1 || loading}
          className="h-8 w-8 p-0"
        >
          <span className="sr-only">Previous Page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xs sm:text-sm font-medium">
          Page {page}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={!hasMore || loading}
          className="h-8 w-8 p-0"
        >
          <span className="sr-only">Next Page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
