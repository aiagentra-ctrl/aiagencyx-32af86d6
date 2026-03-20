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

  return (
    <section className="border-t bg-card/50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
            <CheckCircle className="h-4 w-4" />
            Already Trained
          </span>
        </div>
        <h2 className="mb-3 text-center text-3xl font-bold text-foreground md:text-4xl">
          Your AI Already Knows {companyName}
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          We scraped your website and trained the AI on your real data — menu, pricing, hours, and more.
        </p>

        {/* Business Info Cards */}
        {(businessHours || address || phone) && (
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {address && (
              <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Location</p>
                  <p className="text-sm font-semibold text-foreground">{address}</p>
                </div>
              </div>
            )}
            {businessHours && (
              <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Hours</p>
                  <p className="text-sm font-semibold text-foreground">{businessHours}</p>
                </div>
              </div>
            )}
            {phone && (
              <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
                <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <p className="text-sm font-semibold text-foreground">{phone}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Menu preview */}
        {menuItems.length > 0 && (
          <div>
            <div className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-foreground">
              <Utensils className="h-5 w-5 text-primary" />
              Your Menu ({menuItems.length} items)
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menuItems.slice(0, 9).map((item, i) => (
                <div key={i} className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                    {item.price && <span className="shrink-0 text-sm font-bold text-primary">{item.price}</span>}
                  </div>
                  {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                </div>
              ))}
            </div>
            {menuItems.length > 9 && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                + {menuItems.length - 9} more items — the AI knows them all
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default PersonalizationProofSection;
