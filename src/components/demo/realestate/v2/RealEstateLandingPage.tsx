import { useMemo } from "react";
import { hexToRgba, getContrastColor } from "@/lib/brandColors";
import REHero from "./REHero";
import REDemo from "./REDemo";
import REReveal from "./REReveal";
import REProof from "./REProof";
import REBookCall from "./REBookCall";
import REFooter from "./REFooter";
import type { CallStatus } from "@/pages/DemoPage";

const DEFAULT_CALENDLY = "https://calendly.com/aiagentra/new-meeting";
const DEFAULT_ACCENT = "#1d4ed8";

export interface RealEstateLandingPageProps {
  companyName: string;
  firstName?: string;
  logoUrl?: string;
  brandColor?: string;
  headline?: string;
  subheadline?: string;
  contactEmail?: string;
  contactPhone?: string;
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

/**
 * Real-estate landing template (v2) — a standalone premium editorial page.
 * Distinct layout/palette from the generic and e-commerce demo templates.
 */
const RealEstateLandingPage = ({
  companyName,
  firstName,
  logoUrl,
  brandColor,
  headline,
  subheadline,
  contactEmail,
  contactPhone,
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
  const accent = brandColor?.startsWith("#") ? brandColor : DEFAULT_ACCENT;

  const accentVars = useMemo(
    () =>
      ({
        "--re-accent": accent,
        "--re-accent-fg": getContrastColor(accent),
        "--re-accent-soft": hexToRgba(accent, 0.08),
        "--re-accent-ring": hexToRgba(accent, 0.22),
      }) as React.CSSProperties,
    [accent],
  );

  const handleBookCall = () => {
    window.open(calendarUrl || DEFAULT_CALENDLY, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="re-page min-h-screen" style={accentVars}>
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
        onBookCall={handleBookCall}
      />

      <main>
        <REDemo
          companyName={companyName}
          callStatus={callStatus}
          callSeconds={callSeconds}
          onTryCall={onTryCall}
          onEndCall={onEndCall}
          onTryChat={onTryChat}
          voicePrompts={voicePrompts}
          chatPrompts={chatPrompts}
        />
        <REReveal companyName={companyName} />
        <REProof videoId={videoId} />
        <REBookCall
          companyName={companyName}
          firstName={firstName}
          onBookCall={handleBookCall}
        />
      </main>

      <REFooter
        companyName={companyName}
        logoUrl={logoUrl}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
      />

      {children}
    </div>
  );
};

export default RealEstateLandingPage;