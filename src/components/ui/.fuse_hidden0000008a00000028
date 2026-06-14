import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "default" | "light";
  className?: string;
};

export function Logo({ variant = "default", className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
          variant === "light"
            ? "bg-white text-sidebar"
            : "bg-primary text-white"
        )}
      >
        N
      </span>
      <span
        className={cn(
          "text-lg",
          variant === "light" ? "text-white" : "text-foreground"
        )}
      >
        NexusAI
      </span>
    </Link>
  );
}
