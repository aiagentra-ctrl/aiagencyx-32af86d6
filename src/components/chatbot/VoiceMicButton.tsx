import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking";

interface VoiceMicButtonProps {
  state: VoiceState;
  onClick: () => void;
  disabled?: boolean;
}

const VoiceMicButton = ({ state, onClick, disabled }: VoiceMicButtonProps) => {
  const active = state === "listening" || state === "speaking";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "connecting"}
      title={active ? "Tap to end voice" : "Tap to talk"}
      className={cn(
        "relative shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center transition-all shadow-md",
        active
          ? "bg-destructive text-destructive-foreground shadow-destructive/40 hover:shadow-destructive/60"
          : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-lg",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      aria-label={active ? "Stop voice" : "Start voice"}
    >
      {state === "connecting" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <MicOff className="h-4 w-4 relative z-10" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {active && (
        <>
          <span className="absolute inset-0 rounded-2xl bg-destructive/30 animate-ping" />
          <span className="absolute -inset-1 rounded-2xl bg-destructive/20 animate-pulse" />
        </>
      )}
    </button>
  );
};

export default VoiceMicButton;
