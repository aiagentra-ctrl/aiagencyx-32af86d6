import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/chatbot/ProductCard";
import { ShoppingBag, Sparkles } from "lucide-react";

interface Props {
  chatbotId?: string;
  companyName: string;
  onOpenChat: () => void;
}

const ProductGridSection = ({ chatbotId, companyName, onOpenChat }: Props) => {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!chatbotId) return;
    supabase.from("products").select("*").eq("chatbot_id", chatbotId).limit(8)
      .then(({ data }) => { if (data) setProducts(data); });
  }, [chatbotId]);

  if (!products.length) return null;

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Trained on your full catalog
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            {companyName}'s products — known by your AI
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your AI assistant has memorized every product. Ask it anything — it recommends, compares, and links straight to checkout.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-primary/80 px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-105 transition-all"
          >
            <ShoppingBag className="h-4 w-4" /> Ask the AI for a recommendation
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductGridSection;
