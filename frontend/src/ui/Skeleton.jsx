import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              style={{ maxWidth: colIndex === 0 ? 120 : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonTable };
