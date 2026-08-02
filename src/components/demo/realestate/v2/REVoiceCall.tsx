import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Loader2, AlertTriangle, X } from "lucide-react";
import type { CallStatus } from "@/pages/DemoPage";

interface Props {
  open: boolean;
  companyName: string;
  callStatus: CallStatus;
  callSeconds: number;
  error?: string | null;
  onEndCall: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Dedicated voice-call surface. Completely separate from the chatbot UI —
 * it never opens, embeds or links to the chat window.
 */
const REVoiceCall = ({ open, companyName, callStatus, callSeconds, error, onEndCall, onRetry, onClose }: Props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  const connecting = callStatus === "calling";
  const live = callStatus === "connected";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B0F14]/90 px-5 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-[#232B35] bg-[#151B23] p-8 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close voice call"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#8A94A6] transition-colors hover:bg-white/5 hover:text-[#F5F5F5]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "rgba(249,115,22,0.12)" }}>
          {error ? (
            <AlertTriangle className="h-10 w-10" style={{ color: "#F97316" }} />
          ) : connecting ? (
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#F97316" }} />
          ) : (
            <Phone className={`h-10 w-10 ${live ? "" : ""}`} style={{ color: "#F97316" }} />
          )}
          {live && <span className="absolute h-24 w-24 animate-ping rounded-full" style={{ background: "rgba(249,115,22,0.15)" }} />}
        </div>

        <h3 className="text-[1.25rem] font-bold text-[#F5F5F5]">
          {error ? "Couldn't connect" : live ? `${companyName}'s agent is listening` : connecting ? "Connecting…" : "Call ended"}
        </h3>
        <p className="mt-2 text-sm text-[#9AA4B2]">
          {error
            ? error
            : live
              ? "Speak naturally — ask anything a real buyer would."
              : connecting
                ? "One moment, the agent is picking up."
                : "Thanks for trying the voice agent."}
        </p>

        {(live || callStatus === "ended") && !error && (
          <p className="re-mono mt-3 text-sm tabular-nums text-[#F97316]">{fmt(callSeconds)}</p>
        )}

        <div className="mt-6 space-y-2">
          {live ? (
            <button type="button" onClick={onEndCall} className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full">
              <PhoneOff className="h-[1.15rem] w-[1.15rem]" /> End Call
            </button>
          ) : (
            <button type="button" onClick={onRetry} disabled={connecting} className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full disabled:opacity-60">
              <Phone className="h-[1.15rem] w-[1.15rem]" /> {connecting ? "Connecting…" : error ? "Try again" : "Call again"}
            </button>
          )}
          <button type="button" onClick={onClose} className="min-h-[44px] w-full rounded-xl text-sm font-semibold text-[#9AA4B2] transition-colors hover:text-[#F5F5F5]">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default REVoiceCall;
