import { Utensils, Clock, MapPin, Phone as PhoneIcon, CheckCircle } from "lucide-react";

interface MenuItem {
  name: string;
  price?: string;
  category?: string;
  description?: string;
}

interface PersonalizationProofSectionProps {
  companyName: string;
  menuItems?: MenuItem[];
  categories?: string[];
  businessHours?: string;
  address?: string;
  phone?: string;
}

const PersonalizationProofSection = ({
  companyName, menuItems = [], categories = [], businessHours, address, phone,
}: PersonalizationProofSectionProps) => {
  const hasData = menuItems.length > 0 || businessHours || address || phone;
  if (!hasData) return null;

  // Group menu items by category
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of menuItems) {
    const cat = item.category || "Menu";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  return (
    <section className="border-t px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/8 px-4 py-1.5 text-sm font-semibold text-accent ring-1 ring-accent/15">
            <CheckCircle className="h-3.5 w-3.5" />
            Already Trained
          </span>
        </div>
        <h2 className="mb-3 text-center text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          This AI Already Knows {companyName}
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          We scraped your website and trained the AI on your real business data — menu, pricing, hours, and more.
        </p>

        {/* Business Info Row */}
        {(businessHours || address || phone) && (
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {address && (
              <div className="group flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">{address}</p>
                </div>
              </div>
            )}
            {businessHours && (
              <div className="group flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">{businessHours}</p>
                </div>
              </div>
            )}
            {phone && (
              <div className="group flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <PhoneIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">{phone}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Menu by category */}
        {menuItems.length > 0 && (
          <div>
            <div className="mb-8 flex items-center justify-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-foreground">Your Menu ({menuItems.length} items)</h3>
            </div>

            {Object.entries(grouped).slice(0, 4).map(([category, items]) => (
              <div key={category} className="mb-8">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">{category}</h4>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/15 active:scale-[0.98]">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      {item.price && (
                        <span className="shrink-0 rounded-md bg-primary/8 px-2 py-0.5 text-sm font-bold text-primary">{item.price}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {menuItems.length > 18 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                + {menuItems.length - 18} more items — the AI knows them all
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default PersonalizationProofSection;
