import { Mail, Phone } from "lucide-react";

interface FooterSectionProps {
  businessName: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
}

const FooterSection = ({ businessName, contactEmail, contactPhone, logoUrl }: FooterSectionProps) => {
  return (
    <footer className="border-t bg-card px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={businessName} className="h-8 w-auto rounded object-contain" />
          )}
          <div>
            <p className="font-bold text-foreground">{businessName}</p>
            <p className="text-xs text-muted-foreground">Powered by AI</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 transition-colors hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> {contactEmail}
            </a>
          )}
          {contactPhone && (
            <a href={`tel:${contactPhone}`} className="flex items-center gap-2 transition-colors hover:text-foreground">
              <Phone className="h-3.5 w-3.5" /> {contactPhone}
            </a>
          )}
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-6xl border-t pt-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {businessName}. All rights reserved. •{" "}
        <a href="#" className="hover:text-foreground transition-colors">Privacy</a> •{" "}
        <a href="#" className="hover:text-foreground transition-colors">Terms</a>
      </div>
    </footer>
  );
};

export default FooterSection;
