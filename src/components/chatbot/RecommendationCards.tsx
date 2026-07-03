import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ActionButton } from "./ActionButtons";

export interface RecommendationItem {
  name: string;
  price?: string;
  compare_at_price?: string | null;
  description?: string;
  image_url?: string;
  category?: string;
  in_stock?: boolean;
  rating?: number;
  review_count?: number;
  actions?: ActionButton[];
}

interface RecommendationCardsProps {
  items: RecommendationItem[];
  onAction: (btn: ActionButton) => void;
  disabled?: boolean;
  brandColor?: string;
  onTrackClick?: (item: RecommendationItem) => void;
}

function parseMoney(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function formatMoney(v: string | number | undefined | null): string {
  const n = parseMoney(v);
  return n == null ? String(v ?? "") : `$${n.toFixed(2)}`;
}

const RecommendationCards = ({ items, onAction, disabled, brandColor, onTrackClick }: RecommendationCardsProps) => {
  if (!items.length) return null;
  const brand = brandColor || "#6366F1";

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-3 pt-1 -mx-1 px-1 snap-x snap-mandatory"
      style={{ scrollbarWidth: "thin" }}
    >
      {items.map((item, i) => {
        const price = parseMoney(item.price);
        const compareAt = parseMoney(item.compare_at_price);
        const onSale = price != null && compareAt != null && compareAt > price;
        const savings = onSale ? (compareAt! - price!).toFixed(2) : null;
        const inStock = item.in_stock !== false;
        const primary = item.actions?.[0];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: i * 0.06 }}
            className={cn(
              "group relative flex-shrink-0 w-[200px] snap-start overflow-hidden bg-white shadow-sm",
              "border border-slate-200/70 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            )}
            style={{ borderRadius: 14 }}
          >
            {/* Image */}
            <div className="relative h-[200px] w-full overflow-hidden bg-slate-100" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-3xl opacity-40">
                  📦
                </div>
              )}
              {onSale && (
                <span className="absolute top-2 right-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
                  SALE
                </span>
              )}
            </div>

            {/* Content */}
            <div className="p-3">
              <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                {item.name}
              </h4>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  {price != null && (
                    <span className="text-base font-bold" style={{ color: brand }}>
                      {formatMoney(price)}
                    </span>
                  )}
                  {onSale && (
                    <span className="text-xs text-slate-400 line-through">{formatMoney(compareAt)}</span>
                  )}
                </div>
              </div>
              {savings && (
                <p className="mt-0.5 text-[11px] font-medium text-emerald-600">Save ${savings}</p>
              )}

              <div className="mt-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    inStock
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                  )}
                >
                  <span className="text-[8px]">●</span>
                  {inStock ? "In Stock" : "Out of Stock"}
                </span>
              </div>

              {primary && (
                <button
                  onClick={() => {
                    onTrackClick?.(item);
                    if (primary.url) window.open(primary.url, "_blank", "noopener,noreferrer");
                    else onAction(primary);
                  }}
                  disabled={disabled || !inStock}
                  className={cn(
                    "mt-3 w-full h-9 rounded-lg text-sm font-medium border transition-all",
                    inStock
                      ? "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                      : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {primary.label} <span aria-hidden>↗</span>
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RecommendationCards;
