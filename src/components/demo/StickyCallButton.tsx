import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyCallButtonProps {
  visible: boolean;
  vapiStarted: boolean;
  onTryCall: () => void;
}

const StickyCallButton = ({ visible, vapiStarted, onTryCall }: StickyCallButtonProps) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 animate-slide-up">
      <Button
        size="lg"
        className="gap-2 rounded-full px-6 shadow-lg shadow-primary/30 active:scale-[0.97] transition-transform"
        onClick={onTryCall}
        disabled={vapiStarted}
      >
        <Phone className="h-4 w-4" />
        {vapiStarted ? "Call Active" : "Try AI Call"}
      </Button>
    </div>
  );
};

export default StickyCallButton;
