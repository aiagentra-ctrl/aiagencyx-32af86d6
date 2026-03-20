import { Mail, Phone } from "lucide-react";

interface FooterSectionProps {
  businessName: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
}

const FooterSection = ({ businessName, contactEmail, contactPhone, logoUrl }: FooterSectionProps) => {
  return (
    <footer className="border-t bg-background px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={businessName} className="h-8 w-auto rounded object-contain" />
          )}
          <div>
            <p className="text-lg font-bold text-foreground">{businessName}</p>
            <p className="text-sm text-muted-foreground">Powered by AI Voice Technology</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 hover:text-foreground">
              <Mail className="h-4 w-4" /> {contactEmail}
            </a>
          )}
          {contactPhone && (
            <a href={`tel:${contactPhone}`} className="flex items-center gap-2 hover:text-foreground">
              <Phone className="h-4 w-4" /> {contactPhone}
            </a>
          )}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-5xl border-t pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {businessName}. All rights reserved.
      </div>
    </footer>
  );
};

export default FooterSection;
