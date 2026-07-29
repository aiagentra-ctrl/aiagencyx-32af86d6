import { useCallback } from "react";
import RENav from "./RENav";
import REHero from "./REHero";
import REDemo from "./REDemo";
import REReveal from "./REReveal";
import REProof from "./REProof";
import REBookCall from "./REBookCall";
import RECalendly from "./RECalendly";
import REFooter from "./REFooter";
import { companyDomainFrom } from "./personalize";
import type { CallStatus } from "@/pages/DemoPage";

const DEFAULT_CALENDLY = "https://calendly.com/aiagentra/new-meeting";

export interface RealEstateLandingPageProps {
  companyName: string;
  firstName?: string;
  logoUrl?: string;
  brandColor?: string;
  headline?: string;
  subheadline?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  calendarUrl?: string;
  videoId?: string;
  voicePrompts?: string[];
  chatPrompts?: string[];
  callStatus: CallStatus;
  callSeconds: number;
  onTryCall: () => void;
  onEndCall: () => void;
  onTryChat: () => void;
  children?: React.ReactNode;
}

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * Real-estate landing template (v2) — alternating dark/light sections,
 * orange-only CTAs, blue reserved for brand marks, fully personalised.
 */
const RealEstateLandingPage = ({
  companyName,
  firstName,
  logoUrl,
  headline,
  subheadline,
  contactEmail,
  websiteUrl,
  calendarUrl,
  videoId,
  voicePrompts,
  chatPrompts,
  callStatus,
  callSeconds,
  onTryCall,
  onEndCall,
  onTryChat,
  children,
}: RealEstateLandingPageProps) => {
  const companyDomain = companyDomainFrom({ websiteUrl, contactEmail, companyName });
  const handleBookCall = useCallback(() => scrollTo("book-call"), []);
  const handleTryDemo = useCallback(() => scrollTo("demo-section"), []);

  return (
    <div className="re-page min-h-screen">
      <RENav
        companyName={companyName}
        logoUrl={logoUrl}
        onTryDemo={handleTryDemo}
        onBookCall={handleBookCall}
      />

      <REHero
        companyName={companyName}
        firstName={firstName}
        logoUrl={logoUrl}
        headline={headline}
        subheadline={subheadline}
        callStatus={callStatus}
        callSeconds={callSeconds}
        onTryCall={onTryCall}
        onEndCall={onEndCall}
        onTryChat={onTryChat}
      />

      <main>
        <REDemo
          companyName={companyName}
          firstName={firstName}
          callStatus={callStatus}
          callSeconds={callSeconds}
          onTryCall={onTryCall}
          onEndCall={onEndCall}
          onTryChat={onTryChat}
          voicePrompts={voicePrompts}
          chatPrompts={chatPrompts}
        />
        <REReveal companyName={companyName} logoUrl={logoUrl} companyDomain={companyDomain} />
        <REProof companyName={companyName} videoId={videoId} />
        <REBookCall
          companyName={companyName}
          firstName={firstName}
          onBookCall={handleBookCall}
        />
        <RECalendly companyName={companyName} calendarUrl={calendarUrl || DEFAULT_CALENDLY} />
      </main>

      <REFooter companyName={companyName} onBookCall={handleBookCall} />

      {children}
    </div>
  );
};

export default RealEstateLandingPage;
