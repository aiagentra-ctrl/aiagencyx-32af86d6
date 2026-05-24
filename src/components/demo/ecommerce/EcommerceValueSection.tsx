import { ShoppingCart, Mic, Zap, Clock } from "lucide-react";

const items = [
  { icon: ShoppingCart, title: "Recover lost sales", body: "Shoppers leave when product questions go unanswered. Your AI answers instantly — chat or voice." },
  { icon: Mic, title: "Voice + chat, one window", body: "Tap mic to talk, or type. Same conversation, same context. No separate flows." },
  { icon: Zap, title: "Trained on every product", body: "Names, prices, descriptions, images — all matched and indexed for instant recommendations." },
  { icon: Clock, title: "24/7 product expert", body: "Your team sleeps. Your AI doesn't. Every shopper gets concierge-level help, day or night." },
];

const EcommerceValueSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Built for stores that sell digitally</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Whether you're selling courses, downloads, software, or physical goods — your AI handles every shopper like your best salesperson would.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <div key={i} className="group rounded-3xl border border-border/60 bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{it.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{it.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EcommerceValueSection;
