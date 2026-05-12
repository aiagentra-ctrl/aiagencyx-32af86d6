import { Building2, Bed, Bath, Maximize, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Property {
  name?: string;
  title?: string;
  price?: string;
  beds?: number | string;
  baths?: number | string;
  sqft?: number | string;
  location?: string;
  image_url?: string;
  description?: string;
}

interface PropertyShowcaseSectionProps {
  companyName: string;
  properties?: Property[];
  onChat?: () => void;
  onBookCall?: () => void;
}

const FALLBACK: Property[] = [
  { name: "Modern Downtown Loft", price: "$685,000", beds: 2, baths: 2, sqft: "1,250", location: "Downtown", image_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80" },
  { name: "Waterfront Family Home", price: "$1.2M", beds: 4, baths: 3, sqft: "2,800", location: "Lakeside", image_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80" },
  { name: "Luxury Penthouse Suite", price: "$2.4M", beds: 3, baths: 3, sqft: "3,100", location: "Skyline District", image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80" },
];

const PropertyShowcaseSection = ({ companyName, properties, onChat, onBookCall }: PropertyShowcaseSectionProps) => {
  const list = (properties && properties.length > 0 ? properties : FALLBACK).slice(0, 3);
  return (
    <section className="border-t bg-gradient-to-b from-background to-muted/30 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Building2 className="h-3.5 w-3.5" /> Featured Listings
          </div>
          <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            Properties our AI agent can show you — instantly
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Ask {companyName}'s AI for any of these listings. Get prices, book tours, and connect with an agent in seconds.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {list.map((p, i) => (
            <div
              key={i}
              className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name || p.title || "Property"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                )}
                {p.price && (
                  <div className="absolute left-4 top-4 rounded-full bg-background/95 px-4 py-1.5 text-sm font-bold text-primary shadow-lg backdrop-blur">
                    {p.price}
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="mb-1 line-clamp-1 text-lg font-bold">{p.name || p.title}</h3>
                {p.location && (
                  <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {p.location}
                  </div>
                )}
                <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                  {p.beds != null && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{p.beds} bd</span>}
                  {p.baths != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{p.baths} ba</span>}
                  {p.sqft != null && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{p.sqft} sqft</span>}
                </div>
                <Button onClick={onChat} className="w-full rounded-xl" size="sm">
                  Book a Tour
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={onChat} size="lg" className="rounded-xl px-8">
            <Building2 className="h-4 w-4" /> Ask AI about listings
          </Button>
          <Button onClick={onBookCall} variant="outline" size="lg" className="rounded-xl px-8">
            <Phone className="h-4 w-4" /> Talk to an agent
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PropertyShowcaseSection;
