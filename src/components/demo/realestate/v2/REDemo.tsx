import { motion } from "framer-motion";
import { Phone, PhoneOff, MessageSquare, Sparkles } from "lucide-react";
import { possessive } from "./personalize";
import { NICHE_PACKS, DEFAULT_PACK_ID, nicheCtx, type NichePack } from "@/components/demo/niche/packs";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export interface REDemoProps {
  companyName: string;
  firstName?: string;
  pack?: NichePack;
  callStatus: "idle" | "calling" | "connected" | "ended";
  callSeconds: number;
  onTryCall: () => void;
  onEndCall: () => void;
  onTryChat: () => void;
  voicePrompts?: string[];
  chatPrompts?: string[];
}

const ease = [0.16, 1, 0.3, 1] as const;

const REDemo = ({
  companyName,
  firstName,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
  callStatus,
  callSeconds,
  onTryCall,
  onEndCall,
  onTryChat,
  voicePrompts,
  chatPrompts,
}: REDemoProps) => {
  const isLive = callStatus === "connected";
  const isCalling = callStatus === "calling";
  const co = possessive(companyName);
  const ctx = nicheCtx(companyName, firstName);
  const d = pack.demo;
  const vp = voicePrompts?.length ? voicePrompts : d.voicePrompts;
  const cp = chatPrompts?.length ? chatPrompts : d.chatPrompts;

  return (
    <section
      id="demo-section"
      className="re-section-light scroll-mt-20 px-5 py-10 sm:px-6 lg:px-10 lg:py-14"
    >
      <div className="mx-auto max-w-[78rem]">
        <motion.div
          className="max-w-[40rem]"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, ease }}
        >
          <span className="re-eyebrow">Live demo</span>
          <h2 className="re-h2 mt-3">{d.headline(ctx)}</h2>
          <p className="re-body re-muted-light mt-3">{d.sub(ctx)}</p>
        </motion.div>

        <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2 lg:gap-5">
          {/* Voice */}
          <motion.div
            className="re-card-light re-card-hover p-5 sm:p-6 lg:p-7"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--re-brand-soft)" }}
              >
                <Phone className="h-[1.1rem] w-[1.1rem]" style={{ color: "var(--re-brand)" }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.125rem] font-bold">Voice Agent</h3>
                <p className="text-[0.875rem]" style={{ color: "var(--re-on-light-2)" }}>
                  {d.voiceSub}
                </p>
              </div>
              {isLive && (
                <span
                  className="re-mono ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold tabular-nums"
                  style={{ background: "var(--re-cta-ring)", color: "#9A3412" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--re-cta)" }} />
                  {fmt(callSeconds)}
                </span>
              )}
            </div>

            <div className="mt-5">
              {isLive ? (
                <button
                  type="button"
                  className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                  onClick={onEndCall}
                >
                  <PhoneOff className="h-[1.15rem] w-[1.15rem]" />
                  End Call
                </button>
              ) : (
                <button
                  type="button"
                  className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                  onClick={onTryCall}
                  disabled={isCalling}
                >
                  <Phone className="h-[1.15rem] w-[1.15rem]" />
                  {isCalling ? "Connecting…" : pack.hero.voiceCta(ctx)}
                </button>
              )}
            </div>

            <p className="re-eyebrow mt-6">Try saying</p>
            <ul className="mt-3 space-y-2">
              {vp.slice(0, 4).map((p) => (
                <li
                  key={p}
                  className="rounded-xl px-4 py-3 text-[0.875rem]"
                  style={{ background: "#F3F4F6", color: "var(--re-on-light-2)" }}
                >
                  &ldquo;{p}&rdquo;
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Chat */}
          <motion.div
            className="re-card-light re-card-hover p-5 sm:p-6 lg:p-7"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease, delay: 0.08 }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--re-brand-soft)" }}
              >
                <MessageSquare
                  className="h-[1.1rem] w-[1.1rem]"
                  style={{ color: "var(--re-brand)" }}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.125rem] font-bold">Chat Agent</h3>
                <p className="text-[0.875rem]" style={{ color: "var(--re-on-light-2)" }}>
                  {d.chatSub}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                onClick={onTryChat}
              >
                <Sparkles className="h-[1.15rem] w-[1.15rem]" />
                {pack.hero.chatCta(ctx)}
              </button>
            </div>

            <p className="re-eyebrow mt-6">Try asking</p>
            <ul className="mt-3 space-y-2">
              {cp.slice(0, 4).map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={onTryChat}
                    className="min-h-[44px] w-full rounded-xl px-4 py-3 text-left text-[0.875rem] transition-colors hover:brightness-95"
                    style={{ background: "#F3F4F6", color: "var(--re-on-light-2)" }}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default REDemo;
