import { cn } from "@/lib/utils";
import type { ActionButton } from "./ActionButtons";

export interface RecommendationItem {
  name: string;
  price?: string;
  description?: string;
  image_url?: string;
  category?: string;
  actions?: ActionButton[];
}

interface RecommendationCardsProps {
  items: RecommendationItem[];
  onAction: (btn: ActionButton) => void;
  disabled?: boolean;
}

const RecommendationCards = ({ items, onAction, disabled }: RecommendationCardsProps) => {
  if (!items.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex-shrink-0 w-[200px] rounded-xl border border-border bg-card shadow-sm overflow-hidden",
            "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          )}
        >
          {/* Image */}
          {item.image_url ? (
            <div className="h-28 w-full overflow-hidden bg-muted">
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="h-20 w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <span className="text-2xl opacity-40">
                {item.category?.toLowerCase().includes("menu") || item.category?.toLowerCase().includes("food")
                  ? "🍽️"
                  : item.category?.toLowerCase().includes("product")
                  ? "📦"
                  : "✨"}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-1">
              <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                {item.name}
              </h4>
              {item.price && (
                <span className="flex-shrink-0 text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {item.price}
                </span>
              )}
            </div>

            {item.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {item.description}
              </p>
            )}

            {/* Action buttons */}
            {item.actions && item.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.actions.map((btn, j) => (
                  <button
                    key={j}
                    onClick={() => {
                      if (btn.url) {
                        window.open(btn.url, "_blank", "noopener,noreferrer");
                      } else {
                        onAction(btn);
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground",
                      "transition-colors hover:bg-primary/90",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecommendationCards;
