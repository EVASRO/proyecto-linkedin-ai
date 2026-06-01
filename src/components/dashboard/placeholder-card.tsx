import { cn } from "@/lib/utils";

type PlaceholderCardProps = {
  title: string;
  description: string;
  className?: string;
};

export function PlaceholderCard({
  title,
  description,
  className,
}: PlaceholderCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-[var(--card-shadow)]",
        className
      )}
    >
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-6 h-32 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80" />
    </div>
  );
}
