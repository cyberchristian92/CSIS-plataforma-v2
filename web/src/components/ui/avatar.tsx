import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground",
        className,
      )}
      title={nome}
    >
      {initials(nome)}
    </div>
  );
}
