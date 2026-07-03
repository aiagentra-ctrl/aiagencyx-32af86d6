import { cn } from "@/lib/utils";

interface Props {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
  rounded?: "full" | "lg" | "2xl";
}

/** Company logo with initials fallback. Auto-themed to sit on any background. */
const BusinessLogo = ({ url, name, size = 36, className, rounded = "lg" }: Props) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const radius = rounded === "full" ? "rounded-full" : rounded === "2xl" ? "rounded-2xl" : "rounded-lg";

  if (url) {
    return (
      <div
        className={cn("flex-shrink-0 bg-white p-1 shadow-sm ring-1 ring-black/5 overflow-hidden", radius, className)}
        style={{ width: size, height: size }}
      >
        <img
          src={url}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("flex-shrink-0 flex items-center justify-center font-semibold shadow-sm", radius, className)}
      style={{
        width: size,
        height: size,
        background: "var(--brand, #2563EB)",
        color: "var(--brand-text, #fff)",
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initials || "?"}
    </div>
  );
};

export default BusinessLogo;