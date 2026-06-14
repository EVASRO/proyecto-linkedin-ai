import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "default" | "light";
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ variant = "default", className, width = 120, height = 32 }: LogoProps) {
  // "light" variant = logo for light backgrounds (login panel, PDFs)
  // "default" = navy logo (white text, works on all dark surfaces)
  const src = variant === "light" ? "/logo-rect-light.png" : "/logo-rect-navy.png";

  return (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      <Image
        src={src}
        alt="cazary.ai"
        width={width}
        height={height}
        className="h-auto w-auto object-contain"
        style={{ maxWidth: width, maxHeight: height }}
        priority
      />
    </Link>
  );
}
