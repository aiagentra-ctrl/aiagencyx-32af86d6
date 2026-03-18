import { Bot } from "lucide-react";
import ActionButtons, { type ActionButton } from "./ActionButtons";

interface WelcomeScreenProps {
  businessName: string;
  logoUrl?: string;
  greeting: string;
  quickActions: ActionButton[];
  onAction: (btn: ActionButton) => void;
}

const WelcomeScreen = ({ businessName, logoUrl, greeting, quickActions, onAction }: WelcomeScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in">
      {/* Logo — responsive, supports rectangular */}
      <div className="relative mb-5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={businessName}
            className="h-20 w-auto max-w-[160px] rounded-xl object-contain bg-card shadow-md"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 shadow-md">
            <Bot className="h-8 w-8 text-primary" />
          </div>
        )}
      </div>

      {/* Business name */}
      <h3 className="mb-1 text-lg font-bold text-foreground">{businessName}</h3>
      <p className="mb-6 text-sm text-muted-foreground leading-relaxed max-w-[280px]">{greeting}</p>

      {/* Quick action buttons */}
      {quickActions.length > 0 && (
        <div className="w-full max-w-[300px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            How can we help?
          </p>
          <ActionButtons buttons={quickActions} onAction={onAction} variant="default" />
        </div>
      )}
    </div>
  );
};

export default WelcomeScreen;
