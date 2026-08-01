import { MessageCircle, Mail, Globe, ArrowRight } from "lucide-react";

export interface REFooterProps {
  companyName: string;
  onBookCall: () => void;
}

const WHATSAPP = "+977 982 688 4653";
const WHATSAPP_HREF = "https://wa.me/9779826884653";
const EMAIL = "aigentron@gmail.com";
const SITE = "www.aiagentra.com";

/**
 * Agency footer — represents AI Agentra, never the prospect. Client contact
 * details are deliberately absent. High-contrast text on near-black.
 */
const REFooter = ({ companyName, onBookCall }: REFooterProps) => (
  <footer className="px-5 py-10 sm:px-6 lg:px-10 lg:py-12" style={{ background: "#05070A" }}>
    <div className="mx-auto max-w-[78rem]">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <h2
            className="text-[1.5rem] font-bold tracking-tight"
            style={{ color: "var(--re-on-dark)" }}
          >
            Built for {companyName} by AI Agentra.
          </h2>
          <p
            className="mt-3 max-w-[32rem] text-[1rem] font-normal leading-relaxed"
            style={{ color: "#C7CDD6" }}
          >
            We build AI voice and chat agents for real estate teams — answering, qualifying and
            booking around the clock.
          </p>

          <button
            type="button"
            onClick={onBookCall}
            className="re-btn re-btn-primary re-btn-md mt-6 min-h-[44px]"
          >
            Book a Call
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--re-brand)" }}
          >
            Talk to us
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-3 text-[1rem] font-medium transition-colors hover:opacity-80"
                style={{ color: "#E8EBEF" }}
              >
                <MessageCircle className="h-[1.05rem] w-[1.05rem]" style={{ color: "var(--re-brand)" }} />
                {WHATSAPP}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex min-h-[44px] items-center gap-3 text-[1rem] font-medium transition-colors hover:opacity-80"
                style={{ color: "#E8EBEF" }}
              >
                <Mail className="h-[1.05rem] w-[1.05rem]" style={{ color: "var(--re-brand)" }} />
                {EMAIL}
              </a>
            </li>
            <li>
              <a
                href="https://www.aiagentra.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-3 text-[1rem] font-medium transition-colors hover:opacity-80"
                style={{ color: "#E8EBEF" }}
              >
                <Globe className="h-[1.05rem] w-[1.05rem]" style={{ color: "var(--re-brand)" }} />
                {SITE}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="mt-12 flex flex-wrap items-center justify-between gap-3 pt-6 text-[0.8125rem]"
        style={{ borderTop: "1px solid #1A2029", color: "#98A1AD" }}
      >
        <span>© {new Date().getFullYear()} AI Agentra. All rights reserved.</span>
        <span>Demo page prepared for {companyName}.</span>
      </div>
    </div>
  </footer>
);

export default REFooter;
