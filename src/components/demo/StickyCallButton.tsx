import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CallStatus } from "@/pages/DemoPage";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

interface StickyCallButtonProps {
  visible: boolean;
  callStatus: CallStatus;
  onTryCall: () => void;
  onEndCall: () => void;
}

const StickyCallButton = ({ visible, callStatus, onTryCall, onEndCall }: StickyCallButtonProps) => {
  if (!visible) return null;

  if (callStatus === "connected") {
    return (
      <div className="fixed bottom-5 left-5 z-40 animate-slide-up">
        <Button
          size="lg"
          variant="destructive"
          className="gap-2 rounded-full px-6 shadow-lg active:scale-[0.97] transition-transform"
          onClick={onEndCall}
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 animate-slide-up">
      <Button
        size="lg"
        className="gap-2 rounded-full px-6 shadow-lg shadow-primary/30 active:scale-[0.97] transition-transform"
        onClick={onTryCall}
        disabled={callStatus === "calling"}
      >
        <Phone className="h-4 w-4" />
        {callStatus === "calling" ? "Connecting..." : callStatus === "ended" ? "Call Again" : "Try AI Call"}
      </Button>
    </div>
  );
};

export default StickyCallButton;
