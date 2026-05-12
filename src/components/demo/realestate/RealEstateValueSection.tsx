import { Clock, MessageSquare, Globe2, Calendar } from "lucide-react";

const PILLARS = [
  { icon: Clock, title: "24/7 Lead Capture", desc: "Never miss a buyer call. Your AI agent answers instantly — even at 2 AM." },
  { icon: Calendar, title: "Instant Tour Booking", desc: "Qualifies the buyer, picks the slot, and books the tour without a human." },
  { icon: MessageSquare, title: "Listing Q&A", desc: "Answers price, sqft, schools, HOA — pulled live from your knowledge base." },
  { icon: Globe2, title: "Multilingual", desc: "Speak to international buyers in their language, naturally." },
];

const RealEstateValueSection = () => (
  <section className="border-t px-5 py-20 md:py-24">
    <div className="mx-auto max-w-5xl">
      <div className="mb-12 text-center">
        <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
          Built for real estate teams that close more
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Every minute a lead waits, conversion drops 10%. Our AI agent eliminates the wait.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {PILLARS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-6 transition-all hover:border-primary/40 hover:shadow-lg"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mb-1.5 text-lg font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default RealEstateValueSection;
