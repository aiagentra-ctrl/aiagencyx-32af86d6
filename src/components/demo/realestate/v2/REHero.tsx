import { motion } from "framer-motion";
import { Phone, PhoneOff, MessageSquare } from "lucide-react";
import { possessive } from "./personalize";
import { NICHE_PACKS, DEFAULT_PACK_ID, nicheCtx, type NichePack } from "@/components/demo/niche/packs";


const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export interface REHeroProps {
  companyName: string;
  firstName?: string;
  logoUrl?: string;
  headline?: string;
  subheadline?: string;
  pack?: NichePack;
  callStatus: "idle" | "calling" | "connected" | "ended";
  callSeconds: number;
  onTryCall: () => void;
  onEndCall: () => void;
  onTryChat: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REHero = ({
  companyName,
  firstName,
  logoUrl,
  headline,
  subheadline,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
  callStatus,
  callSeconds,
  onTryCall,
  onEndCall,
  onTryChat,
}: REHeroProps) => {
  const isLive = callStatus === "connected";
  const isCalling = callStatus === "calling";
  const co = possessive(companyName);
  const ctx = nicheCtx(companyName, firstName);
  const h = pack.hero;
  const head = h.headline(ctx);



  const status = isLive
    ? `Live · ${fmt(callSeconds)}`
    : isCalling
      ? "Connecting…"
      : callStatus === "ended"
        ? `Call ended · ${fmt(callSeconds)}`
        : "Incoming call";

  return (
    <section className="re-section-dark re-atmosphere relative overflow-hidden">
      <div className="relative z-10 mx-auto grid max-w-[78rem] items-center gap-9 px-5 pb-11 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-10 lg:pb-16 lg:pt-12">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease }}
        >
          <span className="re-eyebrow inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--re-brand)" }} />
            {h.eyebrow(ctx)}
          </span>

          <h1 className="re-h1 mt-4">
            {headline ?? (
              <>
                {head.lead}{" "}
                <span style={{ color: "var(--re-brand)" }}>{head.highlight}</span>
              </>
            )}
          </h1>

          <p className="re-body re-muted-dark mt-4 max-w-[35rem]" style={{ textWrap: "pretty" }}>
            {subheadline ?? h.subhead(ctx)}
          </p>


          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {isLive ? (
              <button
                type="button"
                className="re-btn re-btn-primary re-btn-lg w-full min-h-[48px] sm:w-auto"
                onClick={onEndCall}
              >
                <PhoneOff className="h-[1.15rem] w-[1.15rem]" />
                End Call · {fmt(callSeconds)}
              </button>
            ) : (
              <button
                type="button"
                className="re-btn re-btn-primary re-btn-lg w-full min-h-[48px] sm:w-auto"
                onClick={onTryCall}
                disabled={isCalling}
              >
                <Phone className="h-[1.15rem] w-[1.15rem]" />
                {isCalling ? "Connecting…" : h.voiceCta(ctx)}
              </button>
            )}
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-lg w-full min-h-[48px] sm:w-auto"
              onClick={onTryChat}
            >
              <MessageSquare className="h-[1.15rem] w-[1.15rem]" />
              {h.chatCta(ctx)}
            </button>
          </div>

          <p className="mt-4 text-[0.8125rem]" style={{ color: "var(--re-on-dark-3)" }}>
            {h.micro}
          </p>

        </motion.div>

        {/* Phone */}
        <motion.div
          className="flex justify-center lg:justify-end"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.95, ease, delay: 0.12 }}
        >
          <div className="relative re-float">
            <div
              className="relative w-[17.5rem] rounded-[2.4rem] p-2.5 sm:w-[19.5rem]"
              style={{
                background: "#05070A",
                border: "1px solid var(--re-line-dark)",
                boxShadow: "0 40px 80px -30px rgba(0,0,0,0.85)",
              }}
            >
              <div
                className="relative overflow-hidden rounded-[2rem] px-6 pb-8 pt-5"
                style={{ background: "var(--re-card-dark)" }}
              >
                <div
                  className="mx-auto mb-8 h-1.5 w-14 rounded-full"
                  style={{ background: "var(--re-line-dark)" }}
                />

                <div className="flex flex-col items-center text-center">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="mb-5 h-16 w-16 rounded-2xl object-contain p-2"
                      style={{ border: "1px solid var(--re-line-dark)" }}
                    />
                  ) : (
                    <div
                      className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{ background: "var(--re-brand-soft)" }}
                    >
                      <Phone className="h-6 w-6" style={{ color: "var(--re-brand)" }} />
                    </div>
                  )}

                  <p className="text-[1.05rem] font-bold">{companyName}</p>
                  <p
                    className="re-mono mt-1 text-[0.78rem] tabular-nums"
                    style={{ color: "var(--re-on-dark-2)" }}
                  >
                    {status}
                  </p>

                  <div className="relative my-9">
                    {callStatus === "idle" && (
                      <>
                        <span
                          className="re-ring absolute inset-0 rounded-full"
                          style={{ background: "var(--re-cta-ring)" }}
                        />
                        <span
                          className="re-ring absolute inset-0 rounded-full"
                          style={{ background: "var(--re-cta-ring)", animationDelay: "0.8s" }}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={isLive ? onEndCall : onTryCall}
                      disabled={isCalling}
                      aria-label={isLive ? "End call" : "Start a call with the AI agent"}
                      className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition-transform duration-200 active:scale-95"
                      style={{
                        background: isLive ? "#EF4444" : "var(--re-cta)",
                        color: "#fff",
                        boxShadow: "0 14px 34px -10px var(--re-cta-ring)",
                      }}
                    >
                      {isLive ? <PhoneOff className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                    </button>
                  </div>

                  <p className="text-[0.75rem]" style={{ color: "var(--re-on-dark-3)" }}>
                    {isLive
                      ? "Tap to hang up"
                      : isCalling
                        ? "Dialling your AI agent…"
                        : "Tap to answer"}
                  </p>
                </div>
              </div>
            </div>

            <motion.div
              className="absolute -left-6 top-24 hidden rounded-2xl px-4 py-2.5 lg:block"
              style={{
                background: "var(--re-card-dark)",
                border: "1px solid var(--re-line-dark)",
                boxShadow: "0 20px 40px -22px rgba(0,0,0,0.9)",
              }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.75 }}
            >
              <p className="text-[0.78rem] font-medium">&ldquo;{h.phoneIn}&rdquo;</p>
            </motion.div>
            <motion.div
              className="absolute -right-8 bottom-28 hidden rounded-2xl px-4 py-2.5 lg:block"
              style={{
                background: "var(--re-card-dark)",
                border: "1px solid var(--re-line-dark)",
                boxShadow: "0 20px 40px -22px rgba(0,0,0,0.9)",
              }}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease, delay: 1 }}
            >
              <p className="text-[0.78rem] font-medium">
                &ldquo;{h.phoneOut}&rdquo;
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default REHero;
