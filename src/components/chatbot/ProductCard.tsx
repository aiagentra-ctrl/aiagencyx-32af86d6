import { ShoppingBag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ProductCardData {
  id?: string;
  name: string;
  price?: number | string;
  currency?: string;
  image_url?: string;
  product_url?: string;
  description?: string;
  category?: string;
}

interface ProductCardProps {
  product: ProductCardData;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const priceStr = product.price !== undefined && product.price !== null && product.price !== ""
    ? `${product.currency === "USD" || !product.currency ? "$" : product.currency + " "}${product.price}`
    : "";
  return (
    <div className="group rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300">
      {product.image_url ? (
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
        </div>
      )}
      <div className="p-3 space-y-2">
        {product.category && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category}
          </span>
        )}
        <h4 className="font-semibold text-sm line-clamp-2 leading-tight">{product.name}</h4>
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          {priceStr && <span className="font-bold text-base text-primary">{priceStr}</span>}
          {product.product_url && (
            <Button
              asChild
              size="sm"
              className="h-8 rounded-xl text-xs ml-auto bg-gradient-to-br from-primary to-primary/80 shadow-sm hover:shadow-md"
            >
              <a href={product.product_url} target="_blank" rel="noopener noreferrer">
                Buy <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
