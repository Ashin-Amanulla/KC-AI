import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({ className, size = "md" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
      aria-hidden="true"
    />
  );
}

export function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
