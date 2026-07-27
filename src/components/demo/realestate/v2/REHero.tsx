import { motion } from "framer-motion";
import { Phone, PhoneOff, MessageSquare, ArrowUpRight } from "lucide-react";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export interface REHeroProps {
  companyName: string;
  firstName?: string;
  logoUrl?: string;
  headline?: string;
  subheadline?: string;
  callStatus: "idle" | "calling" | "connected" | "ended";
  callSeconds: number;
  onTryCall: () => void;
  onEndCall: () => void;
  onTryChat: () => void;
  onBookCall: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REHero = ({
  companyName,
  firstName,
  logoUrl,
  headline,
  subheadline,
  callStatus,
  callSeconds,
  onTryCall,
  onEndCall,
  onTryChat,
  onBookCall,
}: REHeroProps) => {
  const isLive = callStatus === "connected";
  const isCalling = callStatus === "calling";

  const status =
    isLive ? `Live · ${fmt(callSeconds)}`
    : isCalling ? "Connecting…"
    : callStatus === "ended" ? `Call ended · ${fmt(callSeconds)}`
    : "Incoming call";

  return (
    <header className="relative overflow-hidden re-atmosphere">
      {/* Nav */}
      <nav className="relative z-20 mx-auto flex max-w-[78rem] items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${companyName} logo`}
              className="h-9 w-auto max-w-[150px] object-contain"
              loading="eager"
            />
          ) : (
            <span className="text-[1.05rem] font-bold tracking-tight">{companyName}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button className="re-btn re-btn-ghost re-btn-sm" onClick={onTryChat}>
            Try Demo
          </button>
          <button className="re-btn re-btn-primary re-btn-sm" onClick={onBookCall}>
            Book a Call
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <div className="relative z-10 mx-auto grid max-w-[78rem] items-center gap-16 px-6 pb-24 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-10 lg:pb-32 lg:pt-16">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
        >
          <span className="re-eyebrow inline-flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--re-accent)" }}
            />
            AI Agent for {companyName}
          </span>

          <h1 className="mt-6 text-[2.75rem] font-extrabold sm:text-[3.4rem] lg:text-[4.15rem]">
            {headline ?? (
              <>
                {firstName ? `${firstName}, your ` : "Your "}leads won&rsquo;t wait
                <span className="block" style={{ color: "var(--re-accent)" }}>
                  &mdash; will {companyName}?
                </span>
              </>
            )}
          </h1>

          <p
            className="mt-7 max-w-[34rem] text-[1.0625rem] leading-relaxed lg:text-[1.15rem]"
            style={{ color: "hsl(var(--re-ink-2))", textWrap: "pretty" }}
          >
            {subheadline ??
              `Every enquiry answered in seconds — day or night. Your AI agent picks up the phone, qualifies the buyer, and drops a booked viewing straight into ${companyName}'s calendar.`}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {isLive ? (
              <button className="re-btn re-btn-primary re-btn-lg" onClick={onEndCall}>
                <PhoneOff className="h-[1.15rem] w-[1.15rem]" />
                End Call · {fmt(callSeconds)}
              </button>
            ) : (
              <button
                className="re-btn re-btn-primary re-btn-lg"
                onClick={onTryCall}
                disabled={isCalling}
              >
                <Phone className="h-[1.15rem] w-[1.15rem]" />
                {isCalling ? "Connecting…" : "Talk to It Now"}
              </button>
            )}
            <button className="re-btn re-btn-ghost re-btn-lg" onClick={onTryChat}>
              <MessageSquare className="h-[1.15rem] w-[1.15rem]" />
              Chat With It Now
            </button>
          </div>

          <p className="mt-6 text-[0.8125rem]" style={{ color: "hsl(var(--re-ink-3))" }}>
            No signup. No install. Speak to it in the next ten seconds.
          </p>
        </motion.div>

        {/* Phone mockup */}
        <motion.div
          className="flex justify-center lg:justify-end"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.15 }}
        >
          <div className="relative re-float">
            <div
              className="relative w-[19rem] rounded-[2.6rem] p-3 sm:w-[20.5rem]"
              style={{
                background: "hsl(var(--re-ink))",
                boxShadow: "var(--re-shadow-lg)",
              }}
            >
              <div
                className="relative overflow-hidden rounded-[2.1rem] px-6 pb-8 pt-5"
                style={{ background: "hsl(var(--re-surface))" }}
              >
                <div
                  className="mx-auto mb-8 h-1.5 w-16 rounded-full"
                  style={{ background: "hsl(var(--re-line))" }}
                />

                <div className="flex flex-col items-center text-center">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="mb-5 h-16 w-16 rounded-2xl object-contain p-2"
                      style={{ border: "1px solid hsl(var(--re-line))" }}
                    />
                  ) : (
                    <div
                      className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{ background: "var(--re-accent-soft)" }}
                    >
                      <Phone className="h-6 w-6" style={{ color: "var(--re-accent)" }} />
                    </div>
                  )}

                  <p className="text-[1.05rem] font-semibold">{companyName}</p>
                  <p
                    className="mt-1 text-[0.8125rem] tabular-nums"
                    style={{ color: "hsl(var(--re-ink-3))" }}
                  >
                    {status}
                  </p>

                  <div className="relative my-10">
                    {callStatus === "idle" && (
                      <>
                        <span
                          className="absolute inset-0 rounded-full re-ring"
                          style={{ background: "var(--re-accent-ring)" }}
                        />
                        <span
                          className="absolute inset-0 rounded-full re-ring"
                          style={{ background: "var(--re-accent-ring)", animationDelay: "0.8s" }}
                        />
                      </>
                    )}
                    <button
                      onClick={isLive ? onEndCall : onTryCall}
                      disabled={isCalling}
                      aria-label={isLive ? "End call" : "Start call"}
                      className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition-transform duration-200 active:scale-95"
                      style={{
                        background: isLive ? "hsl(var(--re-ink))" : "var(--re-accent)",
                        color: "var(--re-accent-fg)",
                        boxShadow: "0 12px 30px -10px var(--re-accent-ring)",
                      }}
                    >
                      {isLive ? <PhoneOff className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                    </button>
                  </div>

                  <p className="text-[0.75rem]" style={{ color: "hsl(var(--re-ink-3))" }}>
                    {isLive
                      ? "Tap to hang up"
                      : isCalling
                        ? "Dialling your AI agent…"
                        : "Tap to answer"}
                  </p>
                </div>
              </div>
            </div>

            {/* Transcript chips */}
            <motion.div
              className="absolute -left-6 top-24 hidden rounded-2xl px-4 py-2.5 lg:block"
              style={{
                background: "hsl(var(--re-surface))",
                border: "1px solid hsl(var(--re-line))",
                boxShadow: "var(--re-shadow-md)",
              }}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.8 }}
            >
              <p className="text-[0.78rem] font-medium">&ldquo;Is the 3-bed still available?&rdquo;</p>
            </motion.div>
            <motion.div
              className="absolute -right-8 bottom-28 hidden rounded-2xl px-4 py-2.5 lg:block"
              style={{
                background: "hsl(var(--re-surface))",
                border: "1px solid hsl(var(--re-line))",
                boxShadow: "var(--re-shadow-md)",
              }}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease, delay: 1.05 }}
            >
              <p className="text-[0.78rem] font-medium">
                &ldquo;Viewing booked for Thursday, 4pm.&rdquo;
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </header>
  );
};

export default REHero;