import { Mail, Phone } from "lucide-react";

export interface REFooterProps {
  companyName: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const REFooter = ({ companyName, logoUrl, contactEmail, contactPhone }: REFooterProps) => (
  <footer
    className="px-6 py-14 lg:px-10"
    style={{
      borderTop: "1px solid hsl(var(--re-line))",
      background: "hsl(var(--re-canvas-2))",
    }}
  >
    <div className="mx-auto flex max-w-[78rem] flex-col gap-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            className="h-8 w-auto max-w-[130px] object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-[1rem] font-bold">{companyName}</span>
        )}
        <span
          className="text-[0.8125rem]"
          style={{ color: "hsl(var(--re-ink-3))" }}
        >
          AI agent demo
        </span>
      </div>

      <div
        className="flex flex-col gap-3 text-[0.875rem] sm:flex-row sm:gap-7"
        style={{ color: "hsl(var(--re-ink-2))" }}
      >
        {contactEmail && (
          <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {contactEmail}
          </a>
        )}
        {contactPhone && (
          <a href={`tel:${contactPhone}`} className="inline-flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {contactPhone}
          </a>
        )}
      </div>
    </div>

    <div
      className="mx-auto mt-10 max-w-[78rem] pt-7 text-[0.75rem]"
      style={{ borderTop: "1px solid hsl(var(--re-line))", color: "hsl(var(--re-ink-3))" }}
    >
      © {new Date().getFullYear()} {companyName}. Demo built to show what an AI agent can do for
      your business.
    </div>
  </footer>
);

export default REFooter;