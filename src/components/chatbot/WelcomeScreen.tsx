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
      {/* Logo with pulse animation */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/80 p-0.5 shadow-lg shadow-primary/25">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={businessName}
              className="h-full w-full rounded-full object-cover bg-card"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-card">
              <Bot className="h-7 w-7 text-primary" />
            </div>
          )}
        </div>
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
